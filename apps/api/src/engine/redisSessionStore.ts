import { Redis } from '@upstash/redis';
import { Session } from '@coachflow/shared';
import { ISessionStore } from './sessionStore';

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes
const KEY = (n: string) => `session:${n}`;

/**
 * Upstash Redis session store.
 * Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the environment.
 * TTL is managed by Redis — no sweeper needed.
 */
export class RedisSessionStore implements ISessionStore {
  private readonly redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  async get(whatsappNumber: string): Promise<Session | null> {
    const data = await this.redis.get<Session>(KEY(whatsappNumber));
    if (!data) return null;
    // Redis returns plain objects; rehydrate Date fields.
    return {
      ...data,
      stepStartedAt: new Date(data.stepStartedAt),
      lastActivityAt: new Date(data.lastActivityAt),
    };
  }

  async set(session: Session): Promise<void> {
    await this.redis.set(KEY(session.whatsappNumber), session, { ex: SESSION_TTL_SECONDS });
  }

  async delete(whatsappNumber: string): Promise<void> {
    await this.redis.del(KEY(whatsappNumber));
  }

  async size(): Promise<number> {
    const keys = await this.redis.keys('session:*');
    return keys.length;
  }
}
