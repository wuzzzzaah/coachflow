import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client
vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../supabaseClient';
import { listTemplates, cloneJourney } from '../journeys';
import type { JourneyRow, JourneyStepRow } from '@coachflow/shared';

const TENANT = 'tenant-test';
const SOURCE_ID = 'source-journey-id';

const sampleJourney: JourneyRow = {
  id: SOURCE_ID,
  tenant_id: TENANT,
  title: 'Source Journey',
  description: 'Source Description',
  estimated_minutes: 30,
  version_number: 1,
  status: 'published',
  is_template: true,
  schedule_type: 'manual',
  schedule_hour: null,
  schedule_day: null,
  created_at: new Date().toISOString(),
};

const sampleStep: JourneyStepRow = {
  id: 'step-1',
  journey_id: SOURCE_ID,
  tenant_id: TENANT,
  step_index: 0,
  mode: 'coaching',
  title: 'Step 1',
  opening_message: 'Hello',
  min_turns: 3,
  step_guidance: 'Guidance',
  scoring_criteria: null,
  branch_on_low_score: false,
  branch_score_threshold: null,
  branch_step_index: null,
};

function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data, error }));
  // Make the chain thenable
  const promise = Promise.resolve({ data, error });
  Object.assign(chain, {
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  });
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('journeys db helpers', () => {
  describe('listTemplates', () => {
    it('returns templates for a tenant', async () => {
      const chain = makeChain([sampleJourney]);
      const db = { from: vi.fn(() => chain) };
      vi.mocked(supabase).mockReturnValue(db as any);

      const result = await listTemplates(TENANT);
      expect(result).toHaveLength(1);
      expect(result[0].is_template).toBe(true);
      expect(chain.eq).toHaveBeenCalledWith('is_template', true);
    });
  });

  describe('cloneJourney', () => {
    it('clones a journey and its steps', async () => {
      const journeyChain = makeChain(sampleJourney);
      const stepsChain = makeChain([sampleStep]);
      const insertJourneyChain = makeChain({ ...sampleJourney, id: 'new-id', title: 'New Title' });
      const insertStepsChain = makeChain([]);

      // Re-mocking more precisely
      const fromSpy = vi.fn((table: string) => {
          if (table === 'journeys') {
              // First call to journeys is fetch source
              // Second call to journeys is insert new
              return fromSpy.mock.calls.filter(c => c[0] === 'journeys').length === 1 ? journeyChain : insertJourneyChain;
          }
          if (table === 'journey_steps') {
              // First call to journey_steps is fetch source steps
              // Second call to journey_steps is insert new steps
              return fromSpy.mock.calls.filter(c => c[0] === 'journey_steps').length === 1 ? stepsChain : insertStepsChain;
          }
          return {} as any;
      });

      vi.mocked(supabase).mockReturnValue({ from: fromSpy } as any);

      const result = await cloneJourney(SOURCE_ID, TENANT, 'New Title');

      expect(result.id).not.toBe(SOURCE_ID);
      expect(fromSpy).toHaveBeenCalledWith('journeys');
      expect(fromSpy).toHaveBeenCalledWith('journey_steps');

      // Verify insert journey call
      expect(insertJourneyChain.insert).toHaveBeenCalledWith(expect.objectContaining({
          tenant_id: TENANT,
          title: 'New Title',
          is_template: false,
          status: 'draft'
      }));

      // Verify insert steps call
      expect(insertStepsChain.insert).toHaveBeenCalledWith(expect.arrayContaining([
          expect.objectContaining({
              journey_id: expect.any(String),
              title: 'Step 1'
          })
      ]));
    });

    it('throws if source journey not found', async () => {
      const journeyChain = makeChain(null, { message: 'Not found' });
      vi.mocked(supabase).mockReturnValue({ from: vi.fn(() => journeyChain) } as any);

      await expect(cloneJourney(SOURCE_ID, TENANT)).rejects.toThrow('Source journey not found');
    });
  });
});
