import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client
vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../supabaseClient';
import { snapshotJourney, getActiveVersionForUser } from '../journeyVersions';
import type { JourneyRow, JourneyStepRow } from '@coachflow/shared';

const TENANT = 'tenant-test';
const JOURNEY_ID = 'journey-id';
const USER_ID = 'user-id';

const sampleJourney: JourneyRow = {
  id: JOURNEY_ID,
  tenant_id: TENANT,
  title: 'Test Journey',
  description: 'Description',
  estimated_minutes: 30,
  version_number: 1,
  parent_journey_id: null,
  status: 'published',
  is_template: false,
  created_at: new Date().toISOString(),
  schedule_type: 'manual',
  schedule_hour: null,
  schedule_day: null,
};

const sampleStep: JourneyStepRow = {
  id: 'step-1',
  journey_id: JOURNEY_ID,
  tenant_id: TENANT,
  step_index: 0,
  mode: 'coaching',
  title: 'Step 1',
  opening_message: 'Hello',
  min_turns: 3,
  step_guidance: '',
  scoring_criteria: null,
  branch_on_low_score: false,
  branch_score_threshold: null,
  branch_step_index: null,
  media_url: null,
  media_type: null,
};

function makeChain(data: unknown, error: unknown = null, count: number | null = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  // Make the chain thenable
  const promise = Promise.resolve({ data, error, count });
  Object.assign(chain, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('journeyVersions db helpers', () => {
  describe('snapshotJourney', () => {
    it('creates a snapshot and increments version', async () => {
      const journeyChain = makeChain(sampleJourney);
      const stepsChain = makeChain([sampleStep]);
      const insertChain = makeChain({});
      const updateChain = makeChain({});

      const fromSpy = vi.fn((table: string) => {
        if (table === 'journeys') {
          // 1. Fetch, 2. Insert, 3. Update version
          const calls = fromSpy.mock.calls.filter((c) => c[0] === 'journeys').length;
          if (calls === 1) return journeyChain;
          if (calls === 2) return insertChain;
          return updateChain;
        }
        if (table === 'journey_steps') {
          // 1. Fetch, 2. Insert
          return fromSpy.mock.calls.filter((c) => c[0] === 'journey_steps').length === 1
            ? stepsChain
            : insertChain;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {} as any;
      });

      vi.mocked(supabase).mockReturnValue({ from: fromSpy } as unknown as ReturnType<
        typeof supabase
      >);

      const snapshotId = await snapshotJourney(TENANT, JOURNEY_ID);

      expect(snapshotId).toBeDefined();
      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_journey_id: JOURNEY_ID,
          version_number: 1,
          status: 'draft',
        }),
      );
      expect(updateChain.update).toHaveBeenCalledWith({ version_number: 2 });
    });
  });

  describe('getActiveVersionForUser', () => {
    it('returns snapshot ID if user is pinned', async () => {
      const chain = makeChain({ journey_version_id: 'snapshot-id' });
      vi.mocked(supabase).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<
        typeof supabase
      >);

      const result = await getActiveVersionForUser(USER_ID, JOURNEY_ID, TENANT);
      expect(result).toBe('snapshot-id');
      expect(chain.is).toHaveBeenCalledWith('completed_at', null);
    });

    it('returns original journey ID if user not pinned', async () => {
      const chain = makeChain(null);
      vi.mocked(supabase).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<
        typeof supabase
      >);

      const result = await getActiveVersionForUser(USER_ID, JOURNEY_ID, TENANT);
      expect(result).toBe(JOURNEY_ID);
    });
  });
});
