import { describe, it, expect, beforeEach } from 'vitest';
import type { ISessionStore, Session } from '../types';

function makeSession(overrides: Partial<Session> = {}): Session {
  const now = new Date();
  return {
    tenantId: 'tenant-contract',
    userId: 'user-contract',
    whatsappNumber: '15550001000',
    currentJourneyId: null,
    currentStepIndex: 0,
    currentMode: 'menu',
    currentSessionId: null,
    conversationHistory: [],
    stepStartedAt: now,
    lastActivityAt: now,
    turnCount: 0,
    metadata: {},
    ...overrides,
  };
}

/**
 * Run this suite against any ISessionStore implementation to verify contract compliance.
 * Usage: sessionStoreContract(() => new MyStore())
 */
export function sessionStoreContract(factory: () => ISessionStore): void {
  describe('ISessionStore contract', () => {
    let store: ISessionStore;

    beforeEach(() => {
      store = factory();
    });

    it('returns null for a non-existent key', async () => {
      expect(await store.get('unknown')).toBeNull();
    });

    it('stores and retrieves a session by whatsappNumber', async () => {
      const s = makeSession();
      await store.set(s);
      const retrieved = await store.get(s.whatsappNumber);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.whatsappNumber).toBe(s.whatsappNumber);
      expect(retrieved!.tenantId).toBe(s.tenantId);
    });

    it('overwrites a session on a second set', async () => {
      const s = makeSession();
      await store.set(s);
      await store.set({ ...s, currentMode: 'coaching' });
      const retrieved = await store.get(s.whatsappNumber);
      expect(retrieved!.currentMode).toBe('coaching');
    });

    it('deletes a session', async () => {
      const s = makeSession();
      await store.set(s);
      await store.delete(s.whatsappNumber);
      expect(await store.get(s.whatsappNumber)).toBeNull();
    });

    it('delete on a non-existent key does not throw', async () => {
      await expect(store.delete('no-such-key')).resolves.not.toThrow();
    });

    it('size reflects the number of stored sessions', async () => {
      expect(await store.size()).toBe(0);
      await store.set(makeSession({ whatsappNumber: 'A' }));
      await store.set(makeSession({ whatsappNumber: 'B' }));
      expect(await store.size()).toBe(2);
      await store.delete('A');
      expect(await store.size()).toBe(1);
    });
  });
}
