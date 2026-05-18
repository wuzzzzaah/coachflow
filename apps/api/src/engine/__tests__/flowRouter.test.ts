import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock all external I/O before importing the router ─────────────────────
vi.mock('../../whatsapp/sender', () => ({
  sendTextMessage: vi.fn().mockResolvedValue(undefined),
  sendButtonMessage: vi.fn().mockResolvedValue(undefined),
  sendListMessage: vi.fn().mockResolvedValue(undefined),
  markAsRead: vi.fn().mockResolvedValue(undefined),
}));

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
}));

vi.mock('../../db/journeyLoader', () => ({
  listJourneys: vi.fn(),
  getJourney: vi.fn(),
  getStep: vi.fn(),
}));

vi.mock('../../db/tenants', () => ({
  getTenantPromptOverrides: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../ai/geminiClient', () => ({
  generate: vi.fn(),
}));

// ── Imports after mocks are registered ────────────────────────────────────
import { handleInbound } from '../flowRouter';
import { parseWebhook } from '../../whatsapp/parser';
import { configureSessionStore } from '../sessionManager';
import { InMemorySessionStore } from '../inMemorySessionStore';
import { sendTextMessage, sendListMessage } from '../../whatsapp/sender';
import { claimMessage, upsertUser } from '../../db/users';
import { listJourneys, getJourney, getStep } from '../../db/journeyLoader';
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
};

function makeUser(overrides: Partial<{ id: string; onboarded_at: string | null }> = {}) {
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

describe('handleInbound — first message triggers onboarding', () => {
  it('sends welcome list after onboarding exchange', async () => {
    vi.mocked(upsertUser).mockResolvedValue({
      user: makeUser({ onboarded_at: null }),
      created: true,
    });
    const msg = firstMessage(textFixture);
    await handleInbound(msg, TENANT);
    expect(sendListMessage).toHaveBeenCalledOnce();
  });
});

describe('handleInbound — duplicate webhook ignored', () => {
  it('does not call sendTextMessage when claimMessage returns false', async () => {
    vi.mocked(claimMessage).mockResolvedValue(false);
    const msg = firstMessage(duplicateFixture);
    await handleInbound(msg, TENANT);
    expect(sendTextMessage).not.toHaveBeenCalled();
    expect(sendListMessage).not.toHaveBeenCalled();
  });
});

describe('handleInbound — journey selection via button reply', () => {
  it('starts journey and sends opening message', async () => {
    const msg = firstMessage(buttonFixture);
    // msg.replyId is 'maritime-leadership-001' — flowRouter should call startJourney
    await handleInbound(msg, TENANT);
    expect(getJourney).toHaveBeenCalledWith(TENANT, 'maritime-leadership-001');
    expect(sendTextMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Maritime Leadership'),
      undefined,
    );
  });
});

describe('handleInbound — coaching turn', () => {
  it('calls AI and sends response', async () => {
    // Put session into coaching mode first.
    const msg = firstMessage(buttonFixture);
    await handleInbound(msg, TENANT); // starts journey, enters coaching mode
    vi.mocked(generate).mockResolvedValue(
      JSON.stringify({ message: 'Keep going!', intent: 'coach', shouldAdvance: false }),
    );
    // Send a follow-up text message from same number.
    const coachMsg = {
      whatsappNumber: msg.whatsappNumber,
      whatsappMessageId: 'wamid.follow001',
      kind: 'text' as const,
      text: 'I reflect on leadership daily',
    };
    await handleInbound(coachMsg, TENANT);
    expect(generate).toHaveBeenCalled();
    expect(sendTextMessage).toHaveBeenCalledWith(msg.whatsappNumber, 'Keep going!', undefined);
  });
});

describe('handleInbound — step advancement', () => {
  it('calls beginStep when shouldAdvance is true and turnCount meets minTurns', async () => {
    // Start journey.
    const startMsg = firstMessage(buttonFixture);
    await handleInbound(startMsg, TENANT);

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
      .mockResolvedValueOnce(step2); // next step lookup in beginStep

    const followMsg = {
      whatsappNumber: startMsg.whatsappNumber,
      whatsappMessageId: 'wamid.adv001',
      kind: 'text' as const,
      text: 'I am ready',
    };
    await handleInbound(followMsg, TENANT);
    // The router should have opened step 2's opening message.
    expect(sendTextMessage).toHaveBeenCalledWith(startMsg.whatsappNumber, 'Now step 2.', undefined);
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
    await handleInbound(startMsg, TENANT);

    expect(saveScore).toHaveBeenCalledWith(
      expect.objectContaining({
        score: expect.objectContaining({ overall: 75 }),
      }),
    );
    expect(sendTextMessage).toHaveBeenCalledWith(
      startMsg.whatsappNumber,
      expect.stringContaining('Leadership'),
      undefined,
    );
  });
});
