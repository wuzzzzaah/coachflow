import { InboundMessage, ListSection } from '../whatsapp/types';
import {
  sendListMessage,
  sendTextMessage,
  markAsRead,
  SenderCredentials,
} from '../whatsapp/sender';
import {
  appendTurn,
  createSession,
  getSession,
  resetSession,
  updateSession,
} from './sessionManager';
import { trimHistory } from './contextBuilder';
import { parseAIResponse } from './outputParser';
import { generate } from '../ai/geminiClient';
import { upsertUser, markOnboarded, updateUserProgress, claimMessage } from '../db/users';
import {
  startSession as dbStartSession,
  endSession as dbEndSession,
  logMessage,
  getLatestActiveSession,
  getSessionMessages,
} from '../db/sessions';
import { ensureUserJourney, advanceUserJourney, completeUserJourney } from '../db/journeys';
import { saveScore, getScoresForUser } from '../db/scores';
import { listJourneys, getJourney, getStep } from '../db/journeyLoader';
import { getTenantPromptOverrides } from '../db/tenants';
import { AIResponse, JourneyStep, Session } from '@coachflow/shared';

const KEYWORDS = {
  menu: /^(menu|hi|hello|hey|start)\b/i,
  progress: /^progress\b/i,
  reset: /^reset\b/i,
  help: /^help\b/i,
  stop: /^stop\b/i,
};

function maskedNumber(n: string): string {
  return n.length >= 4 ? `***${n.slice(-4)}` : n;
}

function log(whatsappNumber: string, fields: Record<string, unknown>, message: string): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      number: maskedNumber(whatsappNumber),
      ...fields,
      message,
    }),
  );
}

/** Public entry point — handle a single inbound message end-to-end. */
export async function handleInbound(
  msg: InboundMessage,
  tenantId: string,
  senderCreds?: SenderCredentials,
): Promise<void> {
  markAsRead(msg.whatsappMessageId, senderCreds).catch(() => undefined);

  const first = await claimMessage(msg.whatsappMessageId).catch((err) => {
    console.error(`[flowRouter] claimMessage error: ${(err as Error).message}`);
    return true;
  });
  if (!first) {
    log(msg.whatsappNumber, { wa_id: msg.whatsappMessageId }, 'duplicate webhook ignored');
    return;
  }

  const { user, created } = await upsertUser(msg.whatsappNumber, msg.displayName);
  let session = await getSession(msg.whatsappNumber);

  if (!session) {
    if (!created && user.current_journey_id) {
      session = await attemptResume(user, tenantId).catch(() => undefined);
    }
    if (!session) {
      session = await createSession({
        tenantId,
        userId: user.id,
        whatsappNumber: msg.whatsappNumber,
        initialMode: created || !user.onboarded_at ? 'onboarding' : 'menu',
      });
    }
  }

  if (msg.kind === 'unsupported') {
    if (msg.unsupportedType === 'audio') {
      await sendTextMessage(
        msg.whatsappNumber,
        "I can't process voice notes yet — please type your reply. (Voice transcription via Whisper or Deepgram will plug in here in production.)",
        senderCreds,
      );
    } else {
      await sendTextMessage(
        msg.whatsappNumber,
        'I can only process text messages for now. Please type your message.',
        senderCreds,
      );
    }
    return;
  }

  const inputText = (msg.text ?? '').trim();
  if (!inputText) return;

  // Handle journey selection from a WhatsApp list message.
  if (msg.kind === 'list' && msg.replyId) {
    if (await getJourney(tenantId, msg.replyId)) {
      await startJourney(session, msg.replyId, tenantId, senderCreds);
      return;
    }
  }

  if (await handleKeyword(session, inputText, tenantId, senderCreds)) return;

  if (session.currentMode === 'onboarding') {
    await markOnboarded(user.id).catch(() => undefined);
    await sendWelcome(session, tenantId, senderCreds);
    await updateSession(session.whatsappNumber, { currentMode: 'menu' });
    return;
  }

  if (session.currentMode === 'menu') {
    const journeyId = msg.replyId ?? findJourneyByText(inputText, await listJourneys(tenantId));
    if (journeyId && (await getJourney(tenantId, journeyId))) {
      await startJourney(session, journeyId, tenantId, senderCreds);
      return;
    }
    await sendWelcome(session, tenantId, senderCreds);
    return;
  }

  if (session.currentMode === 'journey_complete') {
    await sendTextMessage(
      msg.whatsappNumber,
      "You've completed this journey. Type MENU to choose another.",
      senderCreds,
    );
    return;
  }

  await runStepTurn(session, inputText, msg.whatsappMessageId, tenantId, senderCreds);
}

async function handleKeyword(
  session: Session,
  text: string,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<boolean> {
  if (KEYWORDS.reset.test(text)) {
    if (session.currentSessionId) {
      await dbEndSession(session.currentSessionId, 'reset by user').catch(() => undefined);
    }
    await resetSession(session.whatsappNumber);
    await sendWelcome(session, tenantId, creds);
    return true;
  }
  if (KEYWORDS.help.test(text)) {
    await sendTextMessage(
      session.whatsappNumber,
      [
        '*Available keywords:*',
        'MENU — show journeys',
        'PROGRESS — show your scores and progress',
        'RESET — clear the current session',
        'STOP — pause this conversation',
        'HELP — show this list',
      ].join('\n'),
      creds,
    );
    return true;
  }
  if (KEYWORDS.progress.test(text)) {
    await sendProgress(session, tenantId, creds);
    return true;
  }
  if (KEYWORDS.stop.test(text)) {
    if (session.currentSessionId) {
      await dbEndSession(session.currentSessionId, 'paused by user').catch(() => undefined);
    }
    await updateSession(session.whatsappNumber, { currentMode: 'paused', currentSessionId: null });
    await sendTextMessage(
      session.whatsappNumber,
      "Session paused. Type MENU when you're ready to continue.",
      creds,
    );
    return true;
  }
  if (
    KEYWORDS.menu.test(text) &&
    session.currentMode !== 'coaching' &&
    session.currentMode !== 'roleplay' &&
    session.currentMode !== 'reflection' &&
    session.currentMode !== 'assessment'
  ) {
    await sendWelcome(session, tenantId, creds);
    return true;
  }
  if (KEYWORDS.menu.test(text) && session.currentMode === 'paused') {
    await sendWelcome(session, tenantId, creds);
    await updateSession(session.whatsappNumber, { currentMode: 'menu' });
    return true;
  }
  return false;
}

async function sendWelcome(
  session: Session,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<void> {
  const journeys = await listJourneys(tenantId);
  if (journeys.length === 0) {
    await sendTextMessage(
      session.whatsappNumber,
      'No programmes are available yet. Please check back soon.',
      creds,
    );
    return;
  }
  const sections: ListSection[] = [
    {
      title: 'Available Journeys',
      rows: journeys.map((j) => ({
        id: j.id,
        title: j.title.slice(0, 24),
        description: j.estimatedDuration,
      })),
    },
  ];
  const body =
    'Welcome to your AI leadership coach.\n\nChoose a journey below to begin. You can type MENU, PROGRESS, RESET, or HELP at any time.';
  await sendListMessage(session.whatsappNumber, body, 'Pick a journey', sections, creds);
}

function findJourneyByText(text: string, journeys: { id: string; title: string }[]): string | null {
  const lower = text.toLowerCase();
  for (const j of journeys) {
    if (lower.includes(j.title.toLowerCase()) || lower.includes(j.id.toLowerCase())) return j.id;
  }
  return null;
}

async function startJourney(
  session: Session,
  journeyId: string,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<void> {
  const journey = await getJourney(tenantId, journeyId);
  if (!journey) {
    await sendTextMessage(
      session.whatsappNumber,
      "I couldn't find that journey. Type MENU to pick another.",
      creds,
    );
    return;
  }
  const uj = await ensureUserJourney(session.userId, journeyId);
  const stepIndex = uj.status === 'completed' ? 0 : uj.currentStepIndex;
  await updateUserProgress(session.userId, journeyId, stepIndex).catch(() => undefined);

  await updateSession(session.whatsappNumber, {
    currentJourneyId: journeyId,
    currentStepIndex: stepIndex,
    currentMode: 'journey_intro',
    conversationHistory: [],
    turnCount: 0,
    stepStartedAt: new Date(),
  });
  await sendTextMessage(
    session.whatsappNumber,
    `Starting *${journey.title}* — ${journey.estimatedDuration}.`,
    creds,
  );
  await beginStep(session.whatsappNumber, tenantId, creds);
}

async function beginStep(
  whatsappNumber: string,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<void> {
  const session = await getSession(whatsappNumber);
  if (!session || !session.currentJourneyId) return;
  const step = await getStep(tenantId, session.currentJourneyId, session.currentStepIndex);
  if (!step) {
    await sendTextMessage(
      whatsappNumber,
      'You have completed every step in this journey. Type MENU to start another.',
      creds,
    );
    await updateSession(whatsappNumber, {
      currentMode: 'journey_complete',
      currentSessionId: null,
    });
    return;
  }

  const dbSessionId = await dbStartSession({
    userId: session.userId,
    journeyId: session.currentJourneyId,
    stepId: step.id,
    mode: step.mode,
  });
  const updated = await updateSession(whatsappNumber, {
    currentMode: step.mode,
    currentSessionId: dbSessionId,
    conversationHistory: [],
    turnCount: 0,
    stepStartedAt: new Date(),
  });

  await sendTextMessage(whatsappNumber, step.openingMessage, creds);
  await appendTurn(whatsappNumber, { role: 'assistant', content: step.openingMessage });
  await logMessage({
    sessionId: dbSessionId,
    userId: updated.userId,
    role: 'assistant',
    content: step.openingMessage,
  }).catch((err) => console.error(`[flowRouter] logMessage failed: ${(err as Error).message}`));

  log(whatsappNumber, { session_id: dbSessionId, step: step.id, mode: step.mode }, 'step started');

  if (step.mode === 'assessment') {
    await runStepTurn(updated, '[generate final assessment]', undefined, tenantId, creds);
  }
}

async function runStepTurn(
  sessionIn: Session,
  userText: string,
  whatsappMessageId: string | undefined,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<void> {
  const session = (await getSession(sessionIn.whatsappNumber)) ?? sessionIn;
  if (!session.currentJourneyId || !session.currentSessionId) {
    await sendWelcome(session, tenantId, creds);
    return;
  }
  const step = await getStep(tenantId, session.currentJourneyId, session.currentStepIndex);
  if (!step) return;

  await appendTurn(session.whatsappNumber, { role: 'user', content: userText });
  await logMessage({
    sessionId: session.currentSessionId,
    userId: session.userId,
    whatsappMessageId,
    role: 'user',
    content: userText,
  }).catch((err) => console.error(`[flowRouter] logMessage failed: ${(err as Error).message}`));

  const live = (await getSession(session.whatsappNumber)) ?? session;
  const promptOverrides = await getTenantPromptOverrides(tenantId).catch(() => ({}));

  let aiResponse: AIResponse;
  try {
    const raw = await generate({
      mode: step.mode,
      stepGuidance: step.stepGuidance,
      history: trimHistory(live.conversationHistory.slice(0, -1)),
      latestUserMessage: userText,
      turnCount: live.turnCount,
      promptOverrides,
    });
    aiResponse = parseAIResponse(raw);
  } catch (err) {
    console.error(`[flowRouter] AI generate failed: ${(err as Error).message}`);
    aiResponse = {
      message: 'Something went wrong on my end. Please try again in a moment.',
      intent: 'error',
      shouldAdvance: false,
    };
  }

  const meetsTurnGate = live.turnCount >= step.minTurns;
  const advancing = aiResponse.shouldAdvance && meetsTurnGate;

  await sendTextMessage(session.whatsappNumber, aiResponse.message, creds);
  await appendTurn(session.whatsappNumber, { role: 'assistant', content: aiResponse.message });
  await logMessage({
    sessionId: session.currentSessionId,
    userId: session.userId,
    role: 'assistant',
    content: aiResponse.message,
  }).catch((err) => console.error(`[flowRouter] logMessage failed: ${(err as Error).message}`));

  if (step.mode === 'assessment' && aiResponse.score) {
    await saveScore({
      userId: session.userId,
      sessionId: session.currentSessionId,
      journeyId: session.currentJourneyId,
      stepId: step.id,
      score: aiResponse.score,
    }).catch((err) => console.error(`[flowRouter] saveScore failed: ${(err as Error).message}`));
    await sendTextMessage(session.whatsappNumber, formatScoreCard(aiResponse.score), creds);
  }

  log(
    session.whatsappNumber,
    {
      session_id: session.currentSessionId,
      step: step.id,
      mode: step.mode,
      turn: live.turnCount,
      advance: advancing,
    },
    'turn handled',
  );

  if (advancing) {
    await advanceStep(session, tenantId, creds);
  }
}

function formatScoreCard(score: NonNullable<AIResponse['score']>): string {
  const lines: string[] = ['*Your Leadership Snapshot*', ''];
  for (const d of score.dimensions) {
    lines.push(`${d.name}: ${d.score}/10`);
  }
  lines.push(
    `Overall: ${score.overall}/10`,
    '',
    score.summary,
    '',
    `*Your development focus:* ${score.developmentFocus}`,
    '',
    "Well done on completing this step. Type MENU to see what's next.",
  );
  return lines.join('\n');
}

async function advanceStep(
  session: Session,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<void> {
  if (!session.currentJourneyId || !session.currentSessionId) return;
  const journey = await getJourney(tenantId, session.currentJourneyId);
  if (!journey) return;

  await dbEndSession(session.currentSessionId, 'step advanced').catch(() => undefined);

  const nextIndex = session.currentStepIndex + 1;
  const uj = await ensureUserJourney(session.userId, session.currentJourneyId);

  if (nextIndex >= journey.totalSteps) {
    await completeUserJourney(uj.id).catch(() => undefined);
    await updateUserProgress(session.userId, session.currentJourneyId, nextIndex).catch(
      () => undefined,
    );
    await updateSession(session.whatsappNumber, {
      currentMode: 'journey_complete',
      currentSessionId: null,
      currentStepIndex: nextIndex,
    });
    await sendTextMessage(
      session.whatsappNumber,
      'You have completed every step in this journey. Type MENU to start another.',
      creds,
    );
    return;
  }

  await advanceUserJourney(uj.id, nextIndex).catch(() => undefined);
  await updateUserProgress(session.userId, session.currentJourneyId, nextIndex).catch(
    () => undefined,
  );
  await updateSession(session.whatsappNumber, {
    currentStepIndex: nextIndex,
    currentMode: 'step_complete',
    currentSessionId: null,
  });
  await beginStep(session.whatsappNumber, tenantId, creds);
}

async function sendProgress(
  session: Session,
  tenantId: string,
  creds?: SenderCredentials,
): Promise<void> {
  const scores = await getScoresForUser(session.userId).catch(() => []);
  if (scores.length === 0) {
    await sendTextMessage(
      session.whatsappNumber,
      'No scores yet — complete a journey to see your progress here.',
      creds,
    );
    return;
  }
  const lines: string[] = ['*Your Progress*', ''];
  for (const row of scores.slice(0, 5)) {
    const r = row as { journey_id: string; step_id: string; score: number; created_at: string };
    const journey = await getJourney(tenantId, r.journey_id).catch(() => null);
    const date = new Date(r.created_at).toLocaleDateString();
    lines.push(`${journey?.title ?? r.journey_id} — ${r.score}/10 (${date})`);
  }
  await sendTextMessage(session.whatsappNumber, lines.join('\n'), creds);
}

/** Attempt to restore a session from the database for a returning user. */
async function attemptResume(user: any, tenantId: string): Promise<Session | undefined> {
  const latest = await getLatestActiveSession(user.id);
  if (!latest) return undefined;

  const history = await getSessionMessages(latest.id);

  return createSession({
    tenantId,
    userId: user.id,
    whatsappNumber: user.whatsapp_number,
    initialMode: latest.mode as any,
  }).then(async (s) => {
    return updateSession(s.whatsappNumber, {
      currentJourneyId: latest.journey_id,
      currentStepIndex: user.current_step_index,
      currentSessionId: latest.id,
      conversationHistory: history.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      turnCount: history.filter((m: any) => m.role === 'user').length,
    });
  });
}

export { JourneyStep };
