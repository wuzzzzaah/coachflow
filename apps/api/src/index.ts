import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { verifyWebhook, receiveWebhook, verifySignature } from './whatsapp/webhook';
import {
  activeSessionCount,
  startSessionSweeper,
  configureSessionStore,
} from './engine/sessionManager';
import { InMemorySessionStore } from './engine/inMemorySessionStore';
import { RedisSessionStore } from './engine/redisSessionStore';
import { listJourneys } from './db/journeyLoader';
import { getUserByNumber } from './db/users';
import { getScoresForUser } from './db/scores';
import { getSessionMessages } from './db/sessions';
import { requireAuth } from './middleware/auth';

// Session store — InMemorySessionStore is the default. Swap to RedisSessionStore in
// production by setting UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// When Redis env vars are present the store is replaced; the engine API is unchanged.
const store =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new RedisSessionStore()
    : new InMemorySessionStore();

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.log('[session] using RedisSessionStore');
} else {
  console.log('[session] using InMemorySessionStore');
}

configureSessionStore(store);

const app = express();

// Allow CORS from the Vercel Admin UI
const frontendUrl = process.env.FRONTEND_URL;
if (frontendUrl) {
  app.use(
    cors({
      origin: frontendUrl,
    }),
  );
} else {
  // Allow all if FRONTEND_URL is not set (e.g. local dev fallback)
  app.use(cors());
}

// Capture raw body for X-Hub-Signature-256 HMAC verification on the webhook POST.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

// Webhook endpoints
app.get('/webhook/whatsapp', verifyWebhook);
app.post('/webhook/whatsapp', verifySignature, receiveWebhook);

// Health
app.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: await activeSessionCount(),
  });
});

// Internal API — all routes below require a valid Supabase Auth JWT.
app.use('/api', requireAuth);

app.get('/api/journeys', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const journeys = await listJourneys(tenantId);
    return res.json(journeys);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:number', async (req, res) => {
  try {
    const user = await getUserByNumber(req.params.number);
    if (!user) return res.status(404).json({ error: 'not_found' });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:number/scores', async (req, res) => {
  try {
    const user = await getUserByNumber(req.params.number);
    if (!user) return res.status(404).json({ error: 'not_found' });
    const scores = await getScoresForUser(user.id);
    return res.json(scores);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const msgs = await getSessionMessages(req.params.id);
    return res.json(msgs);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Session sweeper — expire idle sessions every 5 min (replaced by Redis TTL in T8.1).
startSessionSweeper(async (s) => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event: 'session_expired',
      number: s.whatsappNumber.slice(-4),
      step: s.currentStepIndex,
      mode: s.currentMode,
    }),
  );
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`[server] listening on :${port}`);
});
