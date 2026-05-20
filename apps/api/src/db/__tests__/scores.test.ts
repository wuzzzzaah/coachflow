import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client before importing scores.
vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../supabaseClient';
import { getScoresForUser } from '../scores';

function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data, error }));
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

describe('getScoresForUser', () => {
  const userId = 'user-123';
  const journeyId = 'journey-456';
  const mockScores = [
    { id: '1', user_id: userId, journey_id: journeyId, score: 8 },
    { id: '2', user_id: userId, journey_id: journeyId, score: 7 },
  ];

  it('retrieves all scores for a user when journeyId is not provided', async () => {
    const chain = makeChain(mockScores);
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as any);

    const result = await getScoresForUser(userId);

    expect(db.from).toHaveBeenCalledWith('scores');
    expect(chain.eq).toHaveBeenCalledWith('user_id', userId);
    expect(chain.eq).not.toHaveBeenCalledWith('journey_id', expect.anything());
    expect(result).toEqual(mockScores);
  });

  it('filters by journeyId when provided', async () => {
    const chain = makeChain(mockScores);
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as any);

    const result = await getScoresForUser(userId, journeyId);

    expect(db.from).toHaveBeenCalledWith('scores');
    expect(chain.eq).toHaveBeenCalledWith('user_id', userId);
    expect(chain.eq).toHaveBeenCalledWith('journey_id', journeyId);
    expect(result).toEqual(mockScores);
  });

  it('throws an error if Supabase query fails', async () => {
    const chain = makeChain(null, { message: 'Database error' });
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as any);

    await expect(getScoresForUser(userId)).rejects.toThrow('Get scores failed: Database error');
  });

  it('returns an empty array if no data is found', async () => {
    const chain = makeChain(null);
    const db = { from: vi.fn(() => chain) };
    vi.mocked(supabase).mockReturnValue(db as any);

    const result = await getScoresForUser(userId);
    expect(result).toEqual([]);
  });
});
