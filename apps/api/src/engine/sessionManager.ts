import { Session, FlowState, ConversationTurn } from '@coachflow/shared';
import { InMemorySessionStore } from './inMemorySessionStore';
import { ISessionStore } from './sessionStore';

// Default to in-memory store; replaced at startup by configureSessionStore().
let store: ISessionStore = new InMemorySessionStore();

export function configureSessionStore(s: ISessionStore): void {
  store = s;
}

export async function getSession(whatsappNumber: string): Promise<Session | undefined> {
  return (await store.get(whatsappNumber)) ?? undefined;
}

export async function createSession(params: {
  tenantId: string;
  userId: string;
  whatsappNumber: string;
  provider?: 'whatsapp' | 'slack' | 'web';
  initialMode?: FlowState;
}): Promise<Session> {
  const now = new Date();
  const session: Session = {
    tenantId: params.tenantId,
    userId: params.userId,
    whatsappNumber: params.whatsappNumber,
    provider: params.provider ?? 'whatsapp',
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
  await store.set(session);
  return session;
}

export async function updateSession(
  whatsappNumber: string,
  patch: Partial<Session>,
): Promise<Session> {
  const existing = await store.get(whatsappNumber);
  if (!existing) throw new Error(`No session for ${whatsappNumber}`);
  const updated: Session = { ...existing, ...patch, lastActivityAt: new Date() };
  await store.set(updated);
  return updated;
}

export async function appendTurn(whatsappNumber: string, turn: ConversationTurn): Promise<Session> {
  const existing = await store.get(whatsappNumber);
  if (!existing) throw new Error(`No session for ${whatsappNumber}`);
  existing.conversationHistory.push(turn);
  existing.turnCount += turn.role === 'user' ? 1 : 0;
  existing.lastActivityAt = new Date();
  await store.set(existing);
  return existing;
}

export async function resetSession(whatsappNumber: string): Promise<Session | undefined> {
  const existing = await store.get(whatsappNumber);
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
  await store.set(reset);
  return reset;
}

export async function deleteSession(whatsappNumber: string): Promise<void> {
  await store.delete(whatsappNumber);
}

export async function activeSessionCount(): Promise<number> {
  return store.size();
}

export type ExpiryHandler = (session: Session) => Promise<void> | void;

let sweeperHandle: NodeJS.Timeout | null = null;

export function startSessionSweeper(onExpire: ExpiryHandler): void {
  if (sweeperHandle) return;
  if (!(store instanceof InMemorySessionStore)) return; // Redis handles TTL natively

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
