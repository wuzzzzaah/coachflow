import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureSessionStore,
  createSession,
  getSession,
  updateSession,
  appendTurn,
  resetSession,
  deleteSession,
  activeSessionCount,
} from '../sessionManager';
import { InMemorySessionStore } from '../inMemorySessionStore';

beforeEach(() => {
  configureSessionStore(new InMemorySessionStore());
});

const NUMBER = '14155550001';
const TENANT = 'tenant-abc';

async function seed() {
  return await createSession({ tenantId: TENANT, userId: 'user-1', whatsappNumber: NUMBER });
}

describe('createSession', () => {
  it('creates a session with correct defaults', async () => {
    const s = await seed();
    expect(s.whatsappNumber).toBe(NUMBER);
    expect(s.tenantId).toBe(TENANT);
    expect(s.currentMode).toBe('menu');
    expect(s.conversationHistory).toHaveLength(0);
    expect(s.turnCount).toBe(0);
  });

  it('accepts an initialMode override', async () => {
    const s = await createSession({
      tenantId: TENANT,
      userId: 'u',
      whatsappNumber: '999',
      initialMode: 'coaching',
    });
    expect(s.currentMode).toBe('coaching');
  });
});

describe('getSession', () => {
  it('returns the session after creation', async () => {
    await seed();
    const s = await getSession(NUMBER);
    expect(s).toBeDefined();
    expect(s!.whatsappNumber).toBe(NUMBER);
  });

  it('returns undefined for unknown numbers', async () => {
    expect(await getSession('00000')).toBeUndefined();
  });
});

describe('updateSession', () => {
  it('applies a patch to the session', async () => {
    await seed();
    const updated = await updateSession(NUMBER, { currentMode: 'reflection' });
    expect(updated.currentMode).toBe('reflection');
    expect((await getSession(NUMBER))!.currentMode).toBe('reflection');
  });

  it('throws if no session exists', async () => {
    await expect(updateSession('unknown', {})).rejects.toThrow();
  });
});

describe('appendTurn', () => {
  it('appends a user turn and increments turnCount', async () => {
    await seed();
    await appendTurn(NUMBER, { role: 'user', content: 'Hello' });
    const s = (await getSession(NUMBER))!;
    expect(s.conversationHistory).toHaveLength(1);
    expect(s.turnCount).toBe(1);
  });

  it('appends an assistant turn without incrementing turnCount', async () => {
    await seed();
    await appendTurn(NUMBER, { role: 'assistant', content: 'Hi' });
    expect((await getSession(NUMBER))!.turnCount).toBe(0);
  });
});

describe('resetSession', () => {
  it('clears history and resets to menu mode', async () => {
    await seed();
    await updateSession(NUMBER, { currentMode: 'roleplay', currentJourneyId: 'j1' });
    await appendTurn(NUMBER, { role: 'user', content: 'Hi' });
    const reset = (await resetSession(NUMBER))!;
    expect(reset.currentMode).toBe('menu');
    expect(reset.currentJourneyId).toBeNull();
    expect(reset.conversationHistory).toHaveLength(0);
    expect(reset.turnCount).toBe(0);
  });

  it('returns undefined for unknown number', async () => {
    expect(await resetSession('unknown')).toBeUndefined();
  });
});

describe('deleteSession', () => {
  it('removes the session', async () => {
    await seed();
    await deleteSession(NUMBER);
    expect(await getSession(NUMBER)).toBeUndefined();
  });
});

describe('activeSessionCount', () => {
  it('reflects the number of active sessions', async () => {
    expect(await activeSessionCount()).toBe(0);
    await createSession({ tenantId: TENANT, userId: 'u1', whatsappNumber: 'A' });
    await createSession({ tenantId: TENANT, userId: 'u2', whatsappNumber: 'B' });
    expect(await activeSessionCount()).toBe(2);
    await deleteSession('A');
    expect(await activeSessionCount()).toBe(1);
  });
});
