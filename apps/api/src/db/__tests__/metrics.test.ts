import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../supabaseClient';
import { getActiveSessions, getStepDropOff, getStuckUsers } from '../metrics';

const mockTenantId = 'tenant-123';
const mockJourneyId = 'journey-789';

describe('Metrics DB Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveSessions', () => {
    it('returns the count of unique users with active sessions', async () => {
      const db = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({
          data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }],
          error: null,
        }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const count = await getActiveSessions(mockTenantId);
      expect(count).toBe(2);
      expect(db.from).toHaveBeenCalledWith('sessions');
    });

    it('returns 0 when no active sessions found', async () => {
      const db = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const count = await getActiveSessions(mockTenantId);
      expect(count).toBe(0);
    });
  });

  describe('getStepDropOff', () => {
    it('calculates drop-off metrics for each step', async () => {
      const mockSteps = [
        { id: 's1', step_index: 0 },
        { id: 's2', step_index: 1 },
      ];
      const mockSessions = [
        { user_id: 'u1', step_id: 's1', ended_at: '2023-01-01T00:00:00Z' },
        { user_id: 'u2', step_id: 's1', ended_at: null },
        { user_id: 'u1', step_id: 's2', ended_at: '2023-01-01T01:00:00Z' },
      ];

      const db = {
        from: vi.fn((table) => {
          if (table === 'journey_steps') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: mockSteps, error: null }),
            };
          }
          if (table === 'sessions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ data: mockSessions, error: null }),
            } as any;
          }
          return {};
        }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const metrics = await getStepDropOff(mockTenantId, mockJourneyId);
      expect(metrics).toHaveLength(2);
      expect(metrics[0]).toEqual({
        stepIndex: 0,
        reached: 2, // u1, u2
        dropped: 1, // u2 didn't complete
        dropRate: 50,
      });
      expect(metrics[1]).toEqual({
        stepIndex: 1,
        reached: 1, // only u1
        dropped: 0,
        dropRate: 0,
      });
    });
  });

  describe('getStuckUsers', () => {
    it('returns users inactive for longer than threshold', async () => {
      const now = Date.now();
      const mockUserJourneys = [
        { user_id: 'u1', updated_at: new Date(now - 48 * 60 * 60 * 1000).toISOString() }, // 48h ago
      ];

      const db = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: mockUserJourneys, error: null }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const stuck = await getStuckUsers(mockTenantId, 24);
      expect(stuck).toHaveLength(1);
      expect(stuck[0].userId).toBe('u1');
      expect(stuck[0].hoursIdle).toBeGreaterThanOrEqual(48);
    });

    it('returns empty array when no users are stuck', async () => {
      const db = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      vi.mocked(supabase).mockReturnValue(db as any);

      const stuck = await getStuckUsers(mockTenantId);
      expect(stuck).toEqual([]);
    });
  });
});
