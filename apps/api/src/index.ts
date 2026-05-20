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
import { listJourneys, getJourney, createJourney, updateJourney, deleteJourney } from './db/journeyLoader';
import { listTemplates, cloneJourney } from './db/journeys';
import { createStep, updateStep, deleteStep, reorderSteps } from './db/journeySteps';
import { getUserByNumber, searchUsers, getUserProgress } from './db/users';
import { getScoresForUser } from './db/scores';
import { getSessionMessages, getUserSessions, getSessionById } from './db/sessions';
import { listTenants, createTenant, getTenantById, updateTenant, setTenantWhatsAppToken, getTenantWhatsAppToken, getTenantPromptOverrides, upsertTenantPrompt, deleteTenantPrompt } from './db/tenants';
import { listWebhooks, createWebhook, deleteWebhook } from './db/webhooks';
import { getCompletionRates, getStepFunnel, getScoreDistribution } from './db/analytics';
import { getIdleUsers, logReminder } from './db/reminders';
import { sendTextMessage } from './whatsapp/sender';
import { requireAuth, requireRole } from './middleware/auth';
import {
  createJourneySchema,
  updateJourneySchema,
  createJourneyStepSchema,
  updateJourneyStepSchema,
  reorderStepsSchema,
  createTenantSchema,
  updateTenantSchema,
  createTenantWebhookSchema,
  promptKeySchema,
} from '@coachflow/shared';

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

// Tenant management APIs
app.get('/api/tenants', requireRole('super_admin'), async (req, res) => {
  try {
    const tenants = await listTenants();
    return res.json(tenants);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Webhook management APIs
app.get('/api/webhooks', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const webhooks = await listWebhooks(tenantId);
    return res.json(webhooks);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/webhooks', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const parsed = createTenantWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid input', details: parsed.error });
    }

    const webhook = await createWebhook(tenantId, parsed.data);
    return res.status(201).json(webhook);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/webhooks/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    await deleteWebhook(tenantId, req.params.id);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:id/sessions', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const sessions = await getUserSessions(tenantId, req.params.id);
    return res.json(sessions);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:id/sessions/:sessionId/messages', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const messages = await getSessionMessages(req.params.sessionId);
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/sessions/:id', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const session = await getSessionById(tenantId, req.params.id);
    if (!session) return res.status(404).json({ error: 'not_found' });
    return res.json(session);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/reminders/send', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const idleUsers = await getIdleUsers(tenantId);
    if (idleUsers.length === 0) {
      return res.json({ sent: 0, skipped: 0 });
    }

    const token = await getTenantWhatsAppToken(tenantId);
    const tenant = await getTenantById(tenantId);
    if (!token || !tenant?.phone_number_id) {
      return res.status(400).json({ error: 'WhatsApp credentials not configured for this tenant' });
    }

    const creds = { accessToken: token, phoneNumberId: tenant.phone_number_id };
    let sent = 0;
    let skipped = 0;

    for (const user of idleUsers) {
      try {
        const message = `👋 Hey! You're in the middle of ${user.journey_title}. Ready to continue? Just reply here to pick up where you left off.`;
        await sendTextMessage(user.whatsapp_number, message, creds);
        await logReminder(tenantId, user.id);
        sent++;
      } catch (err) {
        console.error(`Failed to send reminder to user ${user.id}:`, err);
        skipped++;
      }
    }

    return res.json({ sent, skipped });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/tenants', requireRole('super_admin'), async (req, res) => {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid input', details: parsed.error });
    }
    const tenant = await createTenant(parsed.data);
    return res.status(201).json(tenant);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/tenants/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const tenant = await getTenantById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'not_found' });
    return res.json(tenant);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/tenants/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid input', details: parsed.error });
    }
    const tenant = await updateTenant(req.params.id, parsed.data);
    return res.json(tenant);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/tenants/:id/whatsapp-token', requireRole('super_admin'), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });
    await setTenantWhatsAppToken(req.params.id, token);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/journeys', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const includeAll = req.query.includeAll === 'true';
    let includeDrafts = false;

    if (includeAll) {
      const user = (req as any).user;
      const role = user?.['https://coachflow.ai/role'] || user?.app_metadata?.role;
      if (role === 'admin' || role === 'super_admin') {
        includeDrafts = true;
      } else {
        return res.status(403).json({ error: 'admin_role_required_for_includeAll' });
      }
    }

    const journeys = await listJourneys(tenantId, includeDrafts);
    return res.json(journeys);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/templates', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const templates = await listTemplates(tenantId);
    return res.json(templates);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/journeys', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const parsed = createJourneySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    await createJourney(tenantId, parsed.data);
    return res.status(201).json({ status: 'created', id: parsed.data.id });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/journeys/:id', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const journey = await getJourney(tenantId, req.params.id);
    if (!journey) return res.status(404).json({ error: 'not_found' });
    return res.json(journey);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/journeys/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const parsed = updateJourneySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    const existing = await getJourney(tenantId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    await updateJourney(tenantId, req.params.id, parsed.data);
    return res.json({ status: 'updated' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/journeys/:id/clone', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const { title } = req.body;
    const newJourney = await cloneJourney(req.params.id, tenantId, title);
    return res.status(201).json(newJourney);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/journeys/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const existing = await getJourney(tenantId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    await deleteJourney(tenantId, req.params.id);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/journeys/:id/steps', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const parsed = createJourneyStepSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    const existing = await getJourney(tenantId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'journey not_found' });

    await createStep(tenantId, req.params.id, parsed.data);
    return res.status(201).json({ status: 'created', id: parsed.data.id });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.patch('/api/journeys/:id/steps/:stepId', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const parsed = updateJourneyStepSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    // Validations to ensure journey exists skipped for brevity, could be added.
    await updateStep(tenantId, req.params.id, req.params.stepId, parsed.data);
    return res.json({ status: 'updated' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/journeys/:id/steps/:stepId', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    await deleteStep(tenantId, req.params.id, req.params.stepId);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/journeys/:id/steps/reorder', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const parsed = reorderStepsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    await reorderSteps(tenantId, req.params.id, parsed.data.order);
    return res.json({ status: 'reordered' });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const q = req.query.q as string | undefined;
    const users = await searchUsers(tenantId, q);
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:id/progress', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const progress = await getUserProgress(tenantId, req.params.id);
    return res.json(progress);
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

app.get('/api/analytics/completion', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const stats = await getCompletionRates(tenantId);
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/analytics/funnel', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    const journeyId = req.query.journeyId as string;
    const since = req.query.since as string | undefined;

    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    if (!journeyId) return res.status(400).json({ error: 'journeyId query param required' });
    const funnel = await getStepFunnel(tenantId, journeyId, since);
    return res.json(funnel);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/analytics/scores', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    const journeyId = req.query.journeyId as string | undefined;
    const since = req.query.since as string | undefined;

    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });
    const scores = await getScoreDistribution(tenantId, journeyId, since);
    return res.json(scores);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});



app.get('/api/tenants/:id/prompts', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const overrides = await getTenantPromptOverrides(req.params.id);
    return res.json(overrides);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/tenants/:id/prompts/:key', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const keyResult = promptKeySchema.safeParse(req.params.key);
    if (!keyResult.success) {
      return res.status(400).json({ error: 'invalid_prompt_key' });
    }
    const { content } = req.body;
    if (typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'content_must_be_non_empty_string' });
    }
    await upsertTenantPrompt(req.params.id, keyResult.data, content);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/tenants/:id/prompts/:key', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const keyResult = promptKeySchema.safeParse(req.params.key);
    if (!keyResult.success) {
      return res.status(400).json({ error: 'invalid_prompt_key' });
    }
    await deleteTenantPrompt(req.params.id, keyResult.data);
    return res.json({ success: true });
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
