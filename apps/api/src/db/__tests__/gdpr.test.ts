import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client
vi.mock('../supabaseClient', () => ({
  supabase: vi.fn(),
}));

// Mock the audit log
vi.mock('../auditLog', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock the users progress
vi.mock('../users', () => ({
  getUserProgress: vi.fn().mockResolvedValue([]),
}));

import { supabase } from '../supabaseClient';
import { eraseUser, exportUserData } from '../gdpr';

const TENANT_ID = 'tenant-123';
const USER_ID = 'user-456';
const ACTOR_ID = 'actor-789';
const ACTOR_EMAIL = 'admin@example.com';

function makeChain(data: any, error: any = null) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data, error }));

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

describe('eraseUser', () => {
  it('anonymizes PII and deletes messages and reminders', async () => {
    const userChain = makeChain({ id: USER_ID });
    const updateChain = makeChain({});
    const deleteChain = makeChain({});

    const db = {
      from: vi.fn((table: string) => {
        if (table === 'users') return userChain;
        if (table === 'messages' || table === 'reminder_log') return deleteChain;
        if (table === 'user_journeys') return updateChain;
        return makeChain({});
      }),
    };
    vi.mocked(supabase).mockReturnValue(db as any);

    await eraseUser(USER_ID, TENANT_ID, ACTOR_ID, ACTOR_EMAIL);

    expect(db.from).toHaveBeenCalledWith('users');
    expect(userChain.select).toHaveBeenCalledWith('id');
    expect(userChain.maybeSingle).toHaveBeenCalled();

    expect(userChain.update).toHaveBeenCalledWith(expect.objectContaining({
      display_name: '[deleted]',
      deleted_at: expect.any(String),
    }));

    expect(db.from).toHaveBeenCalledWith('messages');
    expect(deleteChain.delete).toHaveBeenCalled();

    expect(db.from).toHaveBeenCalledWith('reminder_log');

    expect(db.from).toHaveBeenCalledWith('user_journeys');
    expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({
      deleted_at: expect.any(String),
    }));
  });

  it('throws error if user does not belong to tenant', async () => {
    const userChain = makeChain(null); // User not found
    const db = { from: vi.fn(() => userChain) };
    vi.mocked(supabase).mockReturnValue(db as any);

    await expect(eraseUser(USER_ID, TENANT_ID, ACTOR_ID, ACTOR_EMAIL))
      .rejects.toThrow('User not found or does not belong to tenant');
  });
});

describe('exportUserData', () => {
  it('aggregates data for export', async () => {
    const userData = { id: USER_ID, whatsapp_number: '12345', display_name: 'John', created_at: '2023-01-01' };
    const scoresData = [{ id: 'score-1', score: 8 }];
    const messagesData = [{ id: 'msg-1', session_id: 'sess-1', role: 'user', content: 'hello', created_at: '2023-01-02' }];
    const remindersData = [{ sent_at: '2023-01-03' }];

    const db = {
      from: vi.fn((table: string) => {
        if (table === 'users') return makeChain(userData);
        if (table === 'scores') return makeChain(scoresData);
        if (table === 'messages') return makeChain(messagesData);
        if (table === 'reminder_log') return makeChain(remindersData);
        return makeChain([]);
      }),
    };
    vi.mocked(supabase).mockReturnValue(db as any);

    const result = await exportUserData(USER_ID, TENANT_ID);

    expect(result.user.id).toBe(USER_ID);
    expect(result.user.name).toBe('John');
    expect(result.sessionScores).toHaveLength(1);
    expect(result.sessionMessages).toHaveLength(1);
    expect(result.sessionMessages[0].sessionId).toBe('sess-1');
    expect(result.reminders).toHaveLength(1);
    expect(result.exportedAt).toBeDefined();
  });

  it('throws error if user not found', async () => {
    const db = { from: vi.fn(() => makeChain(null)) };
    vi.mocked(supabase).mockReturnValue(db as any);

    await expect(exportUserData(USER_ID, TENANT_ID)).rejects.toThrow('User not found');
  });
});
