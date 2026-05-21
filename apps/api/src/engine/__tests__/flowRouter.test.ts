import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all external I/O before importing the router ─────────────────────
vi.mock('../../whatsapp/sender', () => {
  const mockAdapter = {
    sendTextMessage: vi.fn().mockResolvedValue(undefined),
    sendButtonMessage: vi.fn().mockResolvedValue(undefined),
    sendListMessage: vi.fn().mockResolvedValue(undefined),
    sendMediaMessage: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ...mockAdapter,
    WhatsAppAdapter: mockAdapter,
  };
});

vi.mock('../../db/users', () => ({
  upsertUser: vi.fn(),
  markOnboarded: vi.fn().mockResolvedValue(undefined),
  updateUserProgress: vi.fn().mockResolvedValue(undefined),
  claimMessage: vi.fn().mockResolvedValue(true), // not a duplicate by default
}));

vi.mock('../../db/sessions', () => ({
  startSession: vi.fn().mockResolvedValue('db-session-1'),
  endSession: vi.fn().mockResolvedValue(undefined),
  logMessage: vi.fn().mockResolvedValue(undefined),
  getLatestActiveSession: vi.fn().mockResolvedValue(null),
  getSessionMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../db/journeys', () => ({
  ensureUserJourney: vi
    .fn()
    .mockResolvedValue({ id: 'uj-1', status: 'in_progress', currentStepIndex: 0 }),
  advanceUserJourney: vi.fn().mockResolvedValue(undefined),
  completeUserJourney: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/scores', () => ({
  saveScore: vi.fn().mockResolvedValue(undefined),
  getScoresForUser: vi.fn().mockResolvedValue([]),
  getLatestScoreForStep: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/journeyLoader', () => ({
  listJourneys: vi.fn(),
  getJourney: vi.fn(),
  getStep: vi.fn(),
}));

vi.mock('../../db/journeyVersions', () => ({
  getActiveVersionForUser: vi.fn().mockImplementation((_userId, journeyId) => Promise.resolve(journeyId)),
  snapshotJourney: vi.fn(),
  getActiveUserCount: vi.fn(),
  listJourneyVersions: vi.fn(),
}));

vi.mock('../../db/tenants', () => ({
  getTenantPromptOverrides: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../ai/geminiClient', () => ({
  generate: vi.fn(),
}));

vi.mock('../../webhooks/deliver', () => ({
  deliverEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../notifications/notify', () => ({
  notifyJourneyComplete: vi.fn().mockResolvedValue(undefined),
  notifyLowScore: vi.fn().mockResolvedValue(undefined),
  notifyIdleUser: vi.fn().mockResolvedValue(undefined),
}));

// ── Imports after mocks are registered ────────────────────────────────────
import { handleInbound } from '../flowRouter';
import { parseWebhook } from '../../whatsapp/parser';
import { configureSessionStore } from '../sessionManager';
import { InMemorySessionStore } from '../inMemorySessionStore';
import { WhatsAppAdapter } from '../../whatsapp/whatsappAdapter';
import { claimMessage, upsertUser } from '../../db/users';
import { listJourneys, getJourney, getStep } from '../../db/journeyLoader';
import { getActiveVersionForUser } from '../../db/journeyVersions';
import { getLatestActiveSession, getSessionMessages } from '../../db/sessions';
import { generate } from '../../ai/geminiClient';

import type { MetaWebhookPayload } from '../../whatsapp/types';
import textFixtureRaw from '../../test/fixtures/meta-text-webhook.json';
import buttonFixtureRaw from '../../test/fixtures/meta-button-webhook.json';
import duplicateFixtureRaw from '../../test/fixtures/meta-duplicate-webhook.json';

const textFixture = textFixtureRaw as unknown as MetaWebhookPayload;
const buttonFixture = buttonFixtureRaw as unknown as MetaWebhookPayload;
const duplicateFixture = duplicateFixtureRaw as unknown as MetaWebhookPayload;

const TENANT = 'tenant-test';

const SAMPLE_JOURNEY = {
  id: 'maritime-leadership-001',
  title: 'Maritime Leadership',
  description: 'Lead at sea.',
  totalSteps: 2,
  estimatedDuration: '45 minutes',
  status: 'published' as const,
  is_template: false,
  schedule_type: 'manual' as const,
  schedule_hour: undefined,
  schedule_day: undefined,
  steps: [],
};

const SAMPLE_STEP = {
  id: 'step-1',
  index: 0,
  mode: 'coaching' as const,
  title: 'Introduction',
  openingMessage: 'Welcome to maritime leadership!',
  minTurns: 1,
  stepGuidance: 'Guide the user.',
  branchOnLowScore: false,
  branchScoreThreshold: null,
  branchStepIndex: null,
  mediaUrl: null,
  mediaType: null,
};

function makeUser(
  overrides: Partial<{
    id: string;
    onboarded_at: string | null;
    current_journey_id: string | null;
    current_step_index: number;
  }> = {},
) {
  const now = new Date().toISOString();
  return {
    id: 'user-abc',
    whatsapp_number: '14155550001',
    display_name: null,
    current_journey_id: null,
    current_step_index: 0,
    onboarded_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

beforeEach(() => {
  configureSessionStore(new InMemorySessionStore());
  vi.clearAllMocks();

  // Default stubs — individual tests can override.
  vi.mocked(upsertUser).mockResolvedValue({ user: makeUser(), created: false });
  vi.mocked(claimMessage).mockResolvedValue(true);
  vi.mocked(listJourneys).mockResolvedValue([SAMPLE_JOURNEY]);
  vi.mocked(getJourney).mockResolvedValue(SAMPLE_JOURNEY);
  vi.mocked(getStep).mockResolvedValue(SAMPLE_STEP);
  vi.mocked(generate).mockResolvedValue(
    JSON.stringify({ message: 'Good work!', intent: 'coach', shouldAdvance: false }),
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────

function firstMessage(fixture: MetaWebhookPayload) {
  return parseWebhook(fixture)[0];
}

// ── Tests ──────────────────────────────────────────────────────────────────

const adapter = new WhatsAppAdapter();
const sendTextMessage = vi.spyOn(adapter, 'sendTextMessage');
const sendListMessage = vi.spyOn(adapter, 'sendListMessage');
const sendMediaMessage = vi.spyOn(adapter, 'sendMediaMessage');

describe('handleInbound — first message triggers onboarding', () => {
  it('sends welcome list for a brand-new user', async () => {
    vi.mocked(upsertUser).mockResolvedValue({
      user: makeUser({ onboarded_at: null }),
      created: true,
    });
    const msg = firstMessage(textFixture);
    await handleInbound(msg, TENANT, adapter);
    expect(sendListMessage).toHaveBeenCalledOnce();
    expect(sendListMessage).toHaveBeenCalledWith(
      msg.whatsappNumber,
      expect.stringContaining('Welcome'),
      'Pick a journey',
      expect.any(Array),
    );
  });
});

describe('handleInbound — conditional branching', () => {
  it('branches to branchStepIndex when score is below threshold', async () => {
    const { getLatestScoreForStep } = await import('../../db/scores');

    const startMsg = firstMessage(buttonFixture);
    await handleInbound(startMsg, TENANT, adapter);

    vi.mocked(getJourney).mockResolvedValue({ ...SAMPLE_JOURNEY, totalSteps: 10 });

    const branchingStep = {
      ...SAMPLE_STEP,
      branchOnLowScore: true,
      branchScoreThreshold: 7,
      branchStepIndex: 5,
    };
    const remedialStep = { ...SAMPLE_STEP, id: 'step-remedial', index: 5, openingMessage: 'Remedial' };

    vi.mocked(getStep)
      .mockResolvedValueOnce(branchingStep) // runStepTurn
      .mockResolvedValueOnce(branchingStep) // advanceStep
      .mockResolvedValueOnce(remedialStep); // beginStep

    vi.mocked(getLatestScoreForStep).mockResolvedValue(5);
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({ message: 'Low score turn', intent: 'advance', shouldAdvance: true }),
    );

    await handleInbound({
      whatsappNumber: startMsg.whatsappNumber,
      whatsappMessageId: 'wamid.branch001',
      kind: 'text' as const, provider: 'whatsapp',
      text: 'I did my best',
    }, TENANT, adapter);

    expect(sendTextMessage).toHaveBeenCalledWith(startMsg.whatsappNumber, 'Remedial');
  });

  it('proceeds to nextIndex when score is above threshold', async () => {
    const { getLatestScoreForStep } = await import('../../db/scores');

    const startMsg = firstMessage(buttonFixture);
    await handleInbound(startMsg, TENANT, adapter);

    vi.mocked(getJourney).mockResolvedValue({ ...SAMPLE_JOURNEY, totalSteps: 10 });

    const branchingStep = {
      ...SAMPLE_STEP,
      branchOnLowScore: true,
      branchScoreThreshold: 7,
      branchStepIndex: 5,
    };
    const nextStep = { ...SAMPLE_STEP, id: 'step-2', index: 1, openingMessage: 'Step 2' };

    vi.mocked(getStep)
      .mockResolvedValueOnce(branchingStep) // runStepTurn
      .mockResolvedValueOnce(branchingStep) // advanceStep
      .mockResolvedValueOnce(nextStep); // beginStep

    vi.mocked(getLatestScoreForStep).mockResolvedValue(9);
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({ message: 'High score turn', intent: 'advance', shouldAdvance: true }),
    );

    await handleInbound({
      whatsappNumber: startMsg.whatsappNumber,
      whatsappMessageId: 'wamid.nobranch001',
      kind: 'text' as const, provider: 'whatsapp',
      text: 'I did great',
    }, TENANT, adapter);

    expect(sendTextMessage).toHaveBeenCalledWith(startMsg.whatsappNumber, 'Step 2');
  });
});

describe('handleInbound — journey completion scorecard', () => {
  it('sends scorecard on final step completion', async () => {
    const { getScoresForUser } = await import('../../db/scores');
    const { completeUserJourney } = await import('../../db/journeys');

    // 1. Start journey. Total steps = 2.
    const startMsg = firstMessage(buttonFixture);
    await handleInbound(startMsg, TENANT, adapter);

    // 2. Mock state to be on the LAST step (index 1)
    const sessionStore = (await import('../sessionManager')).getSession;
    const session = await sessionStore(startMsg.whatsappNumber);
    if (session) {
      session.currentStepIndex = 1;
    }

    // 3. Mock AI response to advance
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({
        message: 'Final step done!',
        intent: 'advance',
        shouldAdvance: true,
      }),
    );

    // 4. Mock journey scores for the scorecard
    vi.mocked(getScoresForUser).mockResolvedValue([
      {
        score: 8,
        criteria: [{ name: 'Empathy', score: 9 }, { name: 'Communication', score: 7 }],
        feedback: 'Great summary here.\n\nDevelopment focus: Listening',
      },
      {
        score: 9,
        criteria: [{ name: 'Empathy', score: 9 }, { name: 'Communication', score: 9 }],
        feedback: 'Good work.',
      }
    ] as any);

    const followMsg = {
      whatsappNumber: startMsg.whatsappNumber,
      whatsappMessageId: 'wamid.comp001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'I am done',
    };

    await handleInbound(followMsg, TENANT, adapter);

    expect(completeUserJourney).toHaveBeenCalled();
    // Verify scorecard message
    expect(sendTextMessage).toHaveBeenCalledWith(
      startMsg.whatsappNumber,
      expect.stringContaining("You've completed *Maritime Leadership*!"),
    );
    expect(sendTextMessage).toHaveBeenCalledWith(
      startMsg.whatsappNumber,
      expect.stringContaining("overall score: 8.5 / 10"),
    );
    expect(sendTextMessage).toHaveBeenCalledWith(
      startMsg.whatsappNumber,
      expect.stringContaining("Empathy — 9/10"),
    );
    expect(sendTextMessage).toHaveBeenCalledWith(
      startMsg.whatsappNumber,
      expect.stringContaining("Great summary here."),
    );
  });
});

describe('handleInbound — idle state handling', () => {
  it('sends journey list when an idle user sends a random message', async () => {
    vi.mocked(upsertUser).mockResolvedValue({
      user: makeUser({ current_journey_id: null }),
      created: false,
    });
    const msg = {
      whatsappNumber: '14155550001',
      whatsappMessageId: 'wamid.idle001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'What can you do?',
    };
    await handleInbound(msg, TENANT, adapter);
    expect(sendListMessage).toHaveBeenCalledOnce();
  });

  it('sends journey list when an idle user sends "start"', async () => {
    vi.mocked(upsertUser).mockResolvedValue({
      user: makeUser({ current_journey_id: null }),
      created: false,
    });
    const msg = {
      whatsappNumber: '14155550001',
      whatsappMessageId: 'wamid.start001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'START',
    };
    await handleInbound(msg, TENANT, adapter);
    expect(sendListMessage).toHaveBeenCalledOnce();
  });

  it('sends fallback message when no journeys are available', async () => {
    vi.mocked(listJourneys).mockResolvedValue([]);
    const msg = {
      whatsappNumber: '14155550001',
      whatsappMessageId: 'wamid.none001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'hi',
    };
    await handleInbound(msg, TENANT, adapter);
    expect(sendTextMessage).toHaveBeenCalledWith(
      msg.whatsappNumber,
      'No programmes are available yet. Please check back soon.',
    );
  });
});

describe('handleInbound — session restoration', () => {
  it('allows switching journey via list message even if mid-coaching', async () => {
    const user = makeUser({ current_journey_id: 'journey-1', current_step_index: 0 });
    vi.mocked(upsertUser).mockResolvedValue({ user, created: false });
    // Mock an active session
    vi.mocked(getLatestActiveSession).mockResolvedValue({
      id: 'db-sess-1',
      journey_id: 'journey-1',
      mode: 'coaching',
      ended_at: null,
    } as any);

    const msg = {
      whatsappNumber: user.whatsapp_number,
      whatsappMessageId: 'wamid.switch001',
      kind: 'list' as const, provider: 'whatsapp' as const,
      replyId: 'maritime-leadership-001',
      text: 'Switching',
    };

    await handleInbound(msg, TENANT, adapter);

    // Should call getJourney for the NEW journey
    expect(getJourney).toHaveBeenCalledWith(TENANT, 'maritime-leadership-001');
    // Should NOT call generate (which would happen if it continued coaching)
    expect(generate).not.toHaveBeenCalled();
    // Should send the "Starting ..." message
    expect(sendTextMessage).toHaveBeenCalledWith(
      user.whatsapp_number,
      expect.stringContaining('Starting'),
    );
  });

  it('resumes a mid-journey user when Redis session is missing', async () => {
    const user = makeUser({ current_journey_id: 'journey-1', current_step_index: 0 });
    vi.mocked(upsertUser).mockResolvedValue({ user, created: false });
    vi.mocked(getLatestActiveSession).mockResolvedValue({
      id: 'db-sess-restored',
      journey_id: 'journey-1',
      mode: 'coaching',
      ended_at: null,
    } as any);
    vi.mocked(getSessionMessages).mockResolvedValue([
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'Hi there' },
    ] as any);

    const msg = {
      whatsappNumber: user.whatsapp_number,
      whatsappMessageId: 'wamid.resume001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'Continued thought',
    };

    await handleInbound(msg, TENANT, adapter);

    // Should have called generate for the coaching turn
    expect(generate).toHaveBeenCalled();
    // And should NOT have sent the welcome message
    expect(sendListMessage).not.toHaveBeenCalled();
  });
});

describe('handleInbound — duplicate webhook ignored', () => {
  it('does not call sendTextMessage when claimMessage returns false', async () => {
    vi.mocked(claimMessage).mockResolvedValue(false);
    const msg = firstMessage(duplicateFixture);
    await handleInbound(msg, TENANT, adapter);
    expect(sendTextMessage).not.toHaveBeenCalled();
    expect(sendListMessage).not.toHaveBeenCalled();
  });
});

describe('handleInbound — journey selection via button reply', () => {
  it('starts journey and sends opening message', async () => {
    const msg = firstMessage(buttonFixture);
    // msg.replyId is 'maritime-leadership-001' — flowRouter should call startJourney
    await handleInbound(msg, TENANT, adapter);
    expect(getJourney).toHaveBeenCalledWith(TENANT, 'maritime-leadership-001');
    expect(sendTextMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Maritime Leadership'),
    );
  });
});

describe('handleInbound — coaching turn', () => {
  it('calls AI and sends response', async () => {
    // Put session into coaching mode first.
    const msg = firstMessage(buttonFixture);
    await handleInbound(msg, TENANT, adapter); // starts journey, enters coaching mode
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({ message: 'Keep going!', intent: 'coach', shouldAdvance: false }),
    );
    // Send a follow-up text message from same number.
    const coachMsg = {
      whatsappNumber: msg.whatsappNumber,
      whatsappMessageId: 'wamid.follow001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'I reflect on leadership daily',
    };
    await handleInbound(coachMsg, TENANT, adapter);
    expect(generate).toHaveBeenCalled();
    expect(sendTextMessage).toHaveBeenCalledWith(msg.whatsappNumber, 'Keep going!');
  });
});

describe('handleInbound — step advancement', () => {
  it('calls beginStep when shouldAdvance is true and turnCount meets minTurns', async () => {
    // Start journey.
    const startMsg = firstMessage(buttonFixture);
    await handleInbound(startMsg, TENANT, adapter);

    // Override AI to request advancement; step minTurns = 1 so one turn suffices.
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({
        message: 'Great, ready to advance!',
        intent: 'advance',
        shouldAdvance: true,
      }),
    );
    const step2 = { ...SAMPLE_STEP, id: 'step-2', index: 1, openingMessage: 'Now step 2.' };
    vi.mocked(getStep)
      .mockResolvedValueOnce(SAMPLE_STEP) // current step lookup in runStepTurn
      .mockResolvedValueOnce(SAMPLE_STEP) // current step lookup in advanceStep
      .mockResolvedValueOnce(step2); // next step lookup in beginStep

    const followMsg = {
      whatsappNumber: startMsg.whatsappNumber,
      whatsappMessageId: 'wamid.adv001',
      kind: 'text' as const, provider: 'whatsapp' as const,
      text: 'I am ready',
    };
    await handleInbound(followMsg, TENANT, adapter);
    // The router should have opened step 2's opening message.
    expect(sendTextMessage).toHaveBeenCalledWith(startMsg.whatsappNumber, 'Now step 2.');
  });
});

describe('handleInbound — assessment + score storage', () => {
  it('saves score and sends scorecard when assessment step returns a score', async () => {
    const { saveScore } = await import('../../db/scores');
    const assessmentStep = { ...SAMPLE_STEP, mode: 'assessment' as const };
    vi.mocked(getStep).mockResolvedValue(assessmentStep);

    const scorePayload = {
      overall: 75,
      summary: 'Solid performance.',
      developmentFocus: 'Communication.',
      dimensions: [{ name: 'Leadership', score: 75, evidence: 'Consistent.' }],
    };
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({
        message: 'Assessment done.',
        intent: 'assess',
        shouldAdvance: false,
        score: scorePayload,
      }),
    );

    // Start journey (will trigger assessment turn automatically via beginStep).
    const startMsg = firstMessage(buttonFixture);
    await handleInbound(startMsg, TENANT, adapter);

    expect(saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({ overall: 75 }),
      }),
    );
    expect(sendTextMessage).toHaveBeenCalledWith(
      startMsg.whatsappNumber,
      expect.stringContaining('Leadership'),
    );
  });
});
