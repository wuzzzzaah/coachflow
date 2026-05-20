import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getIdleUsers, logReminder } from '../reminders';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

describe('reminders db helper', () => {
  const mockDb = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase as any).mockReturnValue(mockDb);
  });

  describe('getIdleUsers', () => {
    it('returns empty array if no active users', async () => {
      mockDb.not.mockResolvedValue({ data: [], error: null });

      const result = await getIdleUsers('tenant-1');
      expect(result).toEqual([]);
      expect(mockDb.from).toHaveBeenCalledWith('users');
    });

    it('filters out users with recent activity or reminders', async () => {
      // 1. Mock active users
      mockDb.not.mockResolvedValueOnce({
        data: [
          { id: 'u1', whatsapp_number: '123', current_journey_id: 'j1' },
          { id: 'u2', whatsapp_number: '456', current_journey_id: 'j1' },
          { id: 'u3', whatsapp_number: '789', current_journey_id: 'j2' },
        ],
        error: null
      });

      // 2. Mock recent messages for u1
      mockDb.gte.mockResolvedValueOnce({
        data: [{ user_id: 'u1' }],
        error: null
      });

      // 3. Mock recent reminders for u2
      mockDb.gte.mockResolvedValueOnce({
        data: [{ user_id: 'u2' }],
        error: null
      });

      // 4. Mock journey titles
      mockDb.from.mockImplementation((table: string) => {
          if (table === 'journeys') {
              return {
                  select: vi.fn().mockReturnThis(),
                  in: vi.fn().mockResolvedValue({
                      data: [
                          { id: 'j1', title: 'Journey 1' },
                          { id: 'j2', title: 'Journey 2' }
                      ],
                      error: null
                  })
              } as any;
          }
          return mockDb;
      });

      const result = await getIdleUsers('tenant-1');

      // Only u3 should remain
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('u3');
      expect(result[0].journey_title).toBe('Journey 2');
    });
  });

  describe('logReminder', () => {
    it('inserts a log entry', async () => {
      mockDb.insert.mockResolvedValue({ error: null });
      await logReminder('tenant-1', 'user-1');
      expect(mockDb.from).toHaveBeenCalledWith('reminder_log');
      expect(mockDb.insert).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
        user_id: 'user-1',
        reminder_type: 'nudge',
      });
    });

    it('throws on error', async () => {
      mockDb.insert.mockResolvedValue({ error: { message: 'db error' } });
      await expect(logReminder('tenant-1', 'user-1')).rejects.toThrow('db error');
    });
  });
});
