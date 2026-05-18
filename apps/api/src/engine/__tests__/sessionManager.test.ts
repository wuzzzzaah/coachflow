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

function seed() {
  return createSession({ tenantId: TENANT, userId: 'user-1', whatsappNumber: NUMBER });
}

describe('createSession', () => {
  it('creates a session with correct defaults', () => {
    const s = seed();
    expect(s.whatsappNumber).toBe(NUMBER);
    expect(s.tenantId).toBe(TENANT);
    expect(s.currentMode).toBe('menu');
    expect(s.conversationHistory).toHaveLength(0);
    expect(s.turnCount).toBe(0);
  });

  it('accepts an initialMode override', () => {
    const s = createSession({
      tenantId: TENANT,
      userId: 'u',
      whatsappNumber: '999',
      initialMode: 'coaching',
    });
    expect(s.currentMode).toBe('coaching');
  });
});

describe('getSession', () => {
  it('returns the session after creation', () => {
    seed();
    const s = getSession(NUMBER);
    expect(s).toBeDefined();
    expect(s!.whatsappNumber).toBe(NUMBER);
  });

  it('returns undefined for unknown numbers', () => {
    expect(getSession('00000')).toBeUndefined();
  });
});

describe('updateSession', () => {
  it('applies a patch to the session', () => {
    seed();
    const updated = updateSession(NUMBER, { currentMode: 'reflection' });
    expect(updated.currentMode).toBe('reflection');
    expect(getSession(NUMBER)!.currentMode).toBe('reflection');
  });

  it('throws if no session exists', () => {
    expect(() => updateSession('unknown', {})).toThrow();
  });
});

describe('appendTurn', () => {
  it('appends a user turn and increments turnCount', () => {
    seed();
    appendTurn(NUMBER, { role: 'user', content: 'Hello' });
    const s = getSession(NUMBER)!;
    expect(s.conversationHistory).toHaveLength(1);
    expect(s.turnCount).toBe(1);
  });

  it('appends an assistant turn without incrementing turnCount', () => {
    seed();
    appendTurn(NUMBER, { role: 'assistant', content: 'Hi' });
    expect(getSession(NUMBER)!.turnCount).toBe(0);
  });
});

describe('resetSession', () => {
  it('clears history and resets to menu mode', () => {
    seed();
    updateSession(NUMBER, { currentMode: 'roleplay', currentJourneyId: 'j1' });
    appendTurn(NUMBER, { role: 'user', content: 'Hi' });
    const reset = resetSession(NUMBER)!;
    expect(reset.currentMode).toBe('menu');
    expect(reset.currentJourneyId).toBeNull();
    expect(reset.conversationHistory).toHaveLength(0);
    expect(reset.turnCount).toBe(0);
  });

  it('returns undefined for unknown number', () => {
    expect(resetSession('unknown')).toBeUndefined();
  });
});

describe('deleteSession', () => {
  it('removes the session', () => {
    seed();
    deleteSession(NUMBER);
    expect(getSession(NUMBER)).toBeUndefined();
  });
});

describe('activeSessionCount', () => {
  it('reflects the number of active sessions', () => {
    expect(activeSessionCount()).toBe(0);
    createSession({ tenantId: TENANT, userId: 'u1', whatsappNumber: 'A' });
    createSession({ tenantId: TENANT, userId: 'u2', whatsappNumber: 'B' });
    expect(activeSessionCount()).toBe(2);
    deleteSession('A');
    expect(activeSessionCount()).toBe(1);
  });
});
