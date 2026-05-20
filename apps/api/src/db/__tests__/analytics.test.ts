import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../supabaseClient';
import {
  getCohortCompletionRate,
  getCohortScoreDistribution,
  getCohortMemberProgress,
} from '../analytics';

const mockTenantId = 'tenant-123';
const mockCohortId = 'cohort-456';
const mockJourneyId = 'journey-789';

describe('Cohort Analytics DB Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCohortCompletionRate', () => {
    it('returns correct completion stats', async () => {
      const mockCohort = { name: 'Cohort A', journey_id: mockJourneyId, journeys: { title: 'Journey A' } };

      const db = {
        from: vi.fn((table) => {
          if (table === 'cohorts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockCohort, error: null }),
            };
          }
          if (table === 'cohort_members') {
            return {
              select: vi.fn((_, options) => {
                if (options?.count === 'exact') {
                   return {
                     eq: vi.fn().mockResolvedValue({ count: 2, error: null })
                   };
                }
                return {
                  eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'u1' }, { user_id: 'u2' }], error: null })
                };
              }),
              eq: vi.fn().mockReturnThis(),
            };
          }
          if (table === 'user_journeys') {
             return {
               select: vi.fn(() => ({
                 eq: vi.fn().mockReturnThis(),
                 in: vi.fn().mockResolvedValue({ count: 1, error: null })
               })),
               eq: vi.fn().mockReturnThis(),
               in: vi.fn().mockReturnThis(),
             };
          }
          return {};
        }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const result = await getCohortCompletionRate(mockTenantId, mockCohortId);

      expect(result).toEqual({
        cohortId: mockCohortId,
        cohortName: 'Cohort A',
        journeyTitle: 'Journey A',
        totalMembers: 2,
        completedMembers: 1,
        completionRate: 50,
      });
    });
  });

  describe('getCohortScoreDistribution', () => {
    it('buckets scores correctly', async () => {
      const mockCohort = { journey_id: mockJourneyId };
      const mockMembers = [{ user_id: 'u1' }, { user_id: 'u2' }];
      const mockScores = [
        { score: 1 }, // 0-2
        { score: 4 }, // 3-4
        { score: 5 }, // 5-6
        { score: 6 }, // 5-6
        { score: 8 }, // 7-8
        { score: 10 }, // 9-10
      ];

      const db = {
        from: vi.fn((table) => {
          if (table === 'cohorts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockCohort, error: null }),
            };
          }
          if (table === 'cohort_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn(() => Promise.resolve({ data: mockMembers, error: null })),
            };
          }
          if (table === 'scores') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn(() => Promise.resolve({ data: mockScores, error: null })),
            };
          }
          return {};
        }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const result = await getCohortScoreDistribution(mockTenantId, mockCohortId);

      expect(result).toEqual([
        { range: '0-2', count: 1 },
        { range: '3-4', count: 1 },
        { range: '5-6', count: 2 },
        { range: '7-8', count: 1 },
        { range: '9-10', count: 1 },
      ]);
    });
  });

  describe('getCohortMemberProgress', () => {
    it('returns progress for each member', async () => {
      const mockCohort = { journey_id: mockJourneyId };
      const mockMembers = [
        { user_id: 'u1', users: { whatsapp_number: '1234567890' } },
        { user_id: 'u2', users: { whatsapp_number: '0987654321' } },
      ];
      const mockSteps = [{ id: 's1' }, { id: 's2' }];
      const mockSessions = [
        { user_id: 'u1', step_id: 's1', started_at: '2023-01-01T00:00:00Z', ended_at: '2023-01-01T01:00:00Z' },
        { user_id: 'u1', step_id: 's2', started_at: '2023-01-02T00:00:00Z', ended_at: '2023-01-02T01:00:00Z' },
        { user_id: 'u2', step_id: 's1', started_at: '2023-01-01T00:00:00Z', ended_at: '2023-01-01T01:00:00Z' },
      ];
      const mockScores = [
        { user_id: 'u1', score: 8 },
        { user_id: 'u1', score: 10 },
        { user_id: 'u2', score: 6 },
      ];

      const db = {
        from: vi.fn((table) => {
          if (table === 'cohorts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockCohort, error: null }),
            };
          }
          if (table === 'cohort_members') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn(() => Promise.resolve({ data: mockMembers, error: null })),
            };
          }
          if (table === 'journey_steps') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn(() => Promise.resolve({ data: mockSteps, error: null })),
            };
          }
          if (table === 'sessions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn(() => Promise.resolve({ data: mockSessions, error: null })),
            };
          }
          if (table === 'scores') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              in: vi.fn(() => Promise.resolve({ data: mockScores, error: null })),
            };
          }
          return {};
        }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const result = await getCohortMemberProgress(mockTenantId, mockCohortId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: 'u1',
        phone: '1234567890',
        completedSteps: 2,
        totalSteps: 2,
        avgScore: 9,
        lastActiveAt: '2023-01-02T01:00:00Z',
      });
      expect(result[1]).toEqual({
        userId: 'u2',
        phone: '0987654321',
        completedSteps: 1,
        totalSteps: 2,
        avgScore: 6,
        lastActiveAt: '2023-01-01T01:00:00Z',
      });
    });
  });
});
