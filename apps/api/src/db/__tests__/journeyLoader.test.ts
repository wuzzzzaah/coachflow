import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client before importing journeyLoader.
vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../supabaseClient';
import { listJourneys, getJourney, getStep } from '../journeyLoader';
import type { JourneyRow, JourneyStepRow } from '@coachflow/shared';

const TENANT = 'tenant-test';
const JOURNEY_ID = 'maritime-001';

const sampleJourney: JourneyRow = {
  id: JOURNEY_ID,
  tenant_id: TENANT,
  title: 'Maritime Leadership',
  description: 'A leadership journey.',
  estimated_minutes: 45,
  version: 1,
  status: 'published',
  created_at: new Date().toISOString(),
};

const sampleStep: JourneyStepRow = {
  id: 'step-1',
  journey_id: JOURNEY_ID,
  tenant_id: TENANT,
  step_index: 0,
  mode: 'coaching',
  title: 'Introduction',
  opening_message: 'Welcome!',
  min_turns: 3,
  step_guidance: 'Guide the user.',
  scoring_criteria: null,
};

function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  // Make the chain thenable for queries that don't call maybeSingle.
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

describe('listJourneys', () => {
  it('returns mapped journey configs', async () => {
    const journeyChain = makeChain([sampleJourney]);
    const stepChain = makeChain([sampleStep]);
    const db = {
      from: vi.fn((table: string) => (table === 'journeys' ? journeyChain : stepChain)),
    };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);

    const result = await listJourneys(TENANT);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(JOURNEY_ID);
    expect(result[0].steps).toHaveLength(1);
    expect(result[0].steps[0].index).toBe(0);
  });

  it('returns empty array when no journeys found', async () => {
    const chain = makeChain([]);
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);
    expect(await listJourneys(TENANT)).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const chain = makeChain(null, { message: 'DB error' });
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);
    await expect(listJourneys(TENANT)).rejects.toThrow('List journeys failed');
  });
});

describe('getJourney', () => {
  it('returns a journey config for a known id', async () => {
    const journeyChain = makeChain(sampleJourney);
    const stepChain = makeChain([sampleStep]);
    const db = {
      from: vi.fn((table: string) => (table === 'journeys' ? journeyChain : stepChain)),
    };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);

    const result = await getJourney(TENANT, JOURNEY_ID);
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Maritime Leadership');
  });

  it('returns null when journey not found', async () => {
    const journeyChain = makeChain(null);
    const db = { from: vi.fn(() => journeyChain) };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);
    expect(await getJourney(TENANT, 'unknown')).toBeNull();
  });
});

describe('getStep', () => {
  it('returns a mapped step for a known index', async () => {
    const chain = makeChain(sampleStep);
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);

    const step = await getStep(TENANT, JOURNEY_ID, 0);
    expect(step).not.toBeNull();
    expect(step!.index).toBe(0);
    expect(step!.mode).toBe('coaching');
  });

  it('returns null when step not found', async () => {
    const chain = makeChain(null);
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as unknown as ReturnType<typeof supabase>);
    expect(await getStep(TENANT, JOURNEY_ID, 99)).toBeNull();
  });
});
