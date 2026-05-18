import { Session, FlowState, ConversationTurn } from '@coachflow/shared';
import { InMemorySessionStore } from './inMemorySessionStore';

// Default to in-memory store; replaced at startup by configureSessionStore().
let store = new InMemorySessionStore();

export function configureSessionStore(s: InMemorySessionStore): void {
  store = s;
}

export function getSession(whatsappNumber: string): Session | undefined {
  return store.getSync(whatsappNumber);
}

export function createSession(params: {
  tenantId: string;
  userId: string;
  whatsappNumber: string;
  initialMode?: FlowState;
}): Session {
  const now = new Date();
  const session: Session = {
    tenantId: params.tenantId,
    userId: params.userId,
    whatsappNumber: params.whatsappNumber,
    currentJourneyId: null,
    currentStepIndex: 0,
    currentMode: params.initialMode ?? 'menu',
    currentSessionId: null,
    conversationHistory: [],
    stepStartedAt: now,
    lastActivityAt: now,
    turnCount: 0,
    metadata: {},
  };
  store.setSync(session);
  return session;
}

export function updateSession(whatsappNumber: string, patch: Partial<Session>): Session {
  const existing = store.getSync(whatsappNumber);
  if (!existing) throw new Error(`No session for ${whatsappNumber}`);
  const updated: Session = { ...existing, ...patch, lastActivityAt: new Date() };
  store.setSync(updated);
  return updated;
}

export function appendTurn(whatsappNumber: string, turn: ConversationTurn): Session {
  const existing = store.getSync(whatsappNumber);
  if (!existing) throw new Error(`No session for ${whatsappNumber}`);
  existing.conversationHistory.push(turn);
  existing.turnCount += turn.role === 'user' ? 1 : 0;
  existing.lastActivityAt = new Date();
  store.setSync(existing);
  return existing;
}

export function resetSession(whatsappNumber: string): Session | undefined {
  const existing = store.getSync(whatsappNumber);
  if (!existing) return undefined;
  const now = new Date();
  const reset: Session = {
    ...existing,
    currentJourneyId: null,
    currentStepIndex: 0,
    currentMode: 'menu',
    currentSessionId: null,
    conversationHistory: [],
    stepStartedAt: now,
    lastActivityAt: now,
    turnCount: 0,
    metadata: {},
  };
  store.setSync(reset);
  return reset;
}

export function deleteSession(whatsappNumber: string): void {
  store.deleteSync(whatsappNumber);
}

export function activeSessionCount(): number {
  return store.sizeSync?.() ?? 0;
}

export type ExpiryHandler = (session: Session) => Promise<void> | void;

let sweeperHandle: NodeJS.Timeout | null = null;

export function startSessionSweeper(onExpire: ExpiryHandler): void {
  if (sweeperHandle) return;
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
  sweeperHandle = setInterval(async () => {
    const s = store as unknown as { sessions?: Map<string, Session> };
    if (!s.sessions) return; // Redis store — TTL handled by Redis, no sweeper needed
    const now = Date.now();
    for (const [number, session] of s.sessions) {
      if (now - session.lastActivityAt.getTime() > SESSION_TTL_MS) {
        s.sessions.delete(number);
        try {
          await onExpire(session);
        } catch (err) {
          console.error(`[sessionManager] expiry handler failed: ${(err as Error).message}`);
        }
      }
    }
  }, SWEEP_INTERVAL_MS);
}

export function stopSessionSweeper(): void {
  if (sweeperHandle) {
    clearInterval(sweeperHandle);
    sweeperHandle = null;
  }
}
