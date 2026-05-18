import { Session } from '@coachflow/shared';
import { ISessionStore } from './sessionStore';

/** In-memory session store used in tests and local development. */
export class InMemorySessionStore implements ISessionStore {
  private readonly sessions = new Map<string, Session>();

  async get(whatsappNumber: string): Promise<Session | null> {
    return this.sessions.get(whatsappNumber) ?? null;
  }

  async set(session: Session): Promise<void> {
    this.sessions.set(session.whatsappNumber, session);
  }

  async delete(whatsappNumber: string): Promise<void> {
    this.sessions.delete(whatsappNumber);
  }

  async size(): Promise<number> {
    return this.sessions.size;
  }

  /** Synchronous get — used internally by the legacy sessionManager shim. */
  getSync(whatsappNumber: string): Session | undefined {
    return this.sessions.get(whatsappNumber);
  }

  /** Synchronous set — used internally by the legacy sessionManager shim. */
  setSync(session: Session): void {
    this.sessions.set(session.whatsappNumber, session);
  }

  /** Synchronous delete — used internally by the legacy sessionManager shim. */
  deleteSync(whatsappNumber: string): void {
    this.sessions.delete(whatsappNumber);
  }

  /** Synchronous count — used by the health endpoint. */
  sizeSync(): number {
    return this.sessions.size;
  }
}
