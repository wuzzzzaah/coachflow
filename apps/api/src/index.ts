import 'dotenv/config';
import crypto from 'node:crypto';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { verifyWebhook, receiveWebhook, verifySignature } from './whatsapp/webhook';
import { receiveSlackWebhook } from './slack/webhook';
import {
  activeSessionCount,
  startSessionSweeper,
  configureSessionStore,
} from './engine/sessionManager';
import { InMemorySessionStore } from './engine/inMemorySessionStore';
import { RedisSessionStore } from './engine/redisSessionStore';
import {
  listJourneys,
  getJourney,
  createJourney,
  updateJourney,
  deleteJourney,
} from './db/journeyLoader';
import { listJourneyVersions, getActiveUserCount } from './db/journeyVersions';
import { listTemplates, cloneJourney } from './db/journeys';
import { createStep, updateStep, deleteStep, reorderSteps } from './db/journeySteps';
import { getUserByNumber, searchUsers, getUserProgress, getUserById } from './db/users';
import { getScoresForUser } from './db/scores';
import { getUsersExportData, getUserExportData } from './db/export';
import { getSessionMessages, getUserSessions, getSessionById } from './db/sessions';
import {
  listTenants,
  createTenant,
  getTenantById,
  updateTenant,
  setTenantWhatsAppToken,
  getTenantWhatsAppToken,
  getTenantPromptOverrides,
  upsertTenantPrompt,
  deleteTenantPrompt,
} from './db/tenants';
import { listWebhooks, createWebhook, deleteWebhook } from './db/webhooks';
import {
  getCompletionRates,
  getStepFunnel,
  getScoreDistribution,
  getCohortCompletionRate,
  getCohortScoreDistribution,
  getCohortMemberProgress,
} from './db/analytics';
import { getActiveSessions, getStepDropOff, getStuckUsers } from './db/metrics';
import { getIdleUsers, logReminder } from './db/reminders';
import { generateScormPackage } from './export/scorm';
import { pollAndClearWebMessages } from './db/webMessages';
import { eraseUser, exportUserData } from './db/gdpr';
import { writeAuditLog, getAuditLog } from './db/auditLog';
import { getNotificationConfig, upsertNotificationConfig } from './db/notifications';
import { listAlertRules, upsertAlertRule, deleteAlertRule } from './db/alertRules';
import { notifyIdleUser } from './notifications/notify';
import { deliverScheduledSteps } from './scheduler/deliverScheduled';
import { handleInbound } from './engine/flowRouter';
import { WebAdapter } from './whatsapp/webAdapter';
import {
  listCohorts,
  getCohort,
  createCohort,
  deleteCohort,
  addCohortMembers,
  removeCohortMember,
  getCohortProgress,
} from './db/cohorts';
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
  notificationConfigSchema,
  createAlertRuleSchema,
  updateAlertRuleSchema,
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

// Handle Slack URL encoded payloads (for interactivity)
app.use(express.urlencoded({ extended: true }));

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

// Web Channel endpoints
app.post('/channel/web/receive', async (req, res) => {
  try {
    const { userId, text, tenantId } = req.body;
    if (!userId || !text || !tenantId) {
      return res.status(400).json({ error: 'userId, text, and tenantId are required' });
    }

    const adapter = new WebAdapter(tenantId, userId);
    // Web channel uses the userId as the "whatsappNumber" for session lookup
    await handleInbound(
      {
        whatsappNumber: userId,
        whatsappMessageId: crypto.randomUUID(),
        kind: 'text' as const,
        provider: 'web' as const,
        text,
      },
      tenantId,
      adapter,
    );

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error(`[web/receive] error: ${(err as Error).message}`);
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/channel/web/poll/:userId', async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const messages = await pollAndClearWebMessages(tenantId, req.params.userId);
    return res.json(messages.map((m) => m.content));
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Slack Channel endpoint
app.post('/slack/events', receiveSlackWebhook);

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

// Operational metrics APIs
app.get('/api/metrics/live', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const [activeSessions, stuckUsersData] = await Promise.all([
      getActiveSessions(tenantId),
      getStuckUsers(tenantId),
    ]);

    return res.json({
      activeSessions,
      stuckUsers: stuckUsersData.length,
    });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get(
  '/api/metrics/dropoff/:journeyId',
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
      if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

      const dropoff = await getStepDropOff(tenantId, req.params.journeyId);
      return res.json(dropoff);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  },
);

app.get('/api/metrics/stuck', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const thresholdHours = req.query.threshold ? parseInt(req.query.threshold as string, 10) : 24;
    const stuck = await getStuckUsers(tenantId, thresholdHours);
    return res.json(stuck);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// SCORM export
app.post(
  '/api/journeys/:id/export/scorm',
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
      if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

      const zipBuffer = await generateScormPackage(tenantId, req.params.id);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="journey-${req.params.id}-scorm.zip"`,
      );
      return res.send(zipBuffer);
    } catch (err) {
      const status = (err as Error).message.includes('published') ? 400 : 500;
      return res.status(status).json({ error: (err as Error).message });
    }
  },
);

// Zapier-compatible webhook test endpoint
app.get('/api/webhooks/test', requireRole('admin', 'super_admin'), async (req, res) => {
  const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';

  const samples = [
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      type: 'user_created',
      data: {
        userId: 'user_01HRAJSB6...',
        tenantId,
        whatsappNumber: '447700900000',
        displayName: 'John Doe',
      },
    },
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      type: 'first_message',
      data: {
        userId: 'user_01HRAJSB6...',
        tenantId,
        whatsappNumber: '447700900000',
      },
    },
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      type: 'step_completed',
      data: {
        userId: 'user_01HRAJSB6...',
        tenantId,
        journeyId: 'journey_leadership_1',
        stepId: 'step_intro_0',
      },
    },
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      type: 'journey_completed',
      data: {
        userId: 'user_01HRAJSB6...',
        tenantId,
        journeyId: 'journey_leadership_1',
      },
    },
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      type: 'step_scored',
      data: {
        userId: 'user_01HRAJSB6...',
        tenantId,
        journeyId: 'journey_leadership_1',
        stepId: 'step_assessment_1',
        score: 8.5,
        dimensions: [
          { name: 'Active Listening', score: 9, feedback: 'Demonstrated exceptional focus.' },
          { name: 'Clarity of Thought', score: 8, feedback: 'Articulated goals well.' },
        ],
      },
    },
  ];

  // If type query param is provided, filter to that type.
  // Zapier polling triggers can use this to get relevant samples.
  const type = req.query.type as string;
  if (type) {
    return res.json(samples.filter((s) => s.type === type));
  }

  return res.json(samples);
});

app.get('/api/cohorts/:id/analytics', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const [completionRate, scoreDistribution, memberProgress] = await Promise.all([
      getCohortCompletionRate(tenantId, req.params.id),
      getCohortScoreDistribution(tenantId, req.params.id),
      getCohortMemberProgress(tenantId, req.params.id),
    ]);

    return res.json({ completionRate, scoreDistribution, memberProgress });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// GDPR compliance APIs
app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    await eraseUser(req.params.id, tenantId, req.user!.id, req.user!.email || '');
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:id/data-export', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const data = await exportUserData(req.params.id, tenantId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.params.id}.json"`);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Journey versioning APIs
app.get('/api/journeys/:id/versions', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const versions = await listJourneyVersions(tenantId, req.params.id);
    return res.json(versions);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get(
  '/api/journeys/:id/active-user-count',
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
      if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

      const count = await getActiveUserCount(tenantId, req.params.id);
      return res.json({ count });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  },
);

// Notification Config APIs
app.get('/api/notifications/config', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const config = await getNotificationConfig(tenantId);
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/notifications/config', requireRole('admin'), async (req, res) => {
  try {
    const parsed = notificationConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid input', details: parsed.error });
    }

    const config = await upsertNotificationConfig(parsed.data.tenant_id, parsed.data);
    return res.json(config);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Alert Rules APIs
app.get('/api/alert-rules', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const rules = await listAlertRules(tenantId);
    return res.json(rules);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/alert-rules', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const parsed = createAlertRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid input', details: parsed.error });
    }

    const rule = await upsertAlertRule(tenantId, parsed.data);

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'alert_rule.create',
      resource: 'alert_rule',
      resourceId: rule.id,
      metadata: parsed.data,
    });

    return res.status(201).json(rule);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/alert-rules/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const parsed = updateAlertRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid input', details: parsed.error });
    }

    const rule = await upsertAlertRule(tenantId, { ...parsed.data, id: req.params.id });

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'alert_rule.update',
      resource: 'alert_rule',
      resourceId: rule.id,
      metadata: parsed.data,
    });

    return res.json(rule);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/alert-rules/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    await deleteAlertRule(tenantId, req.params.id);

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'alert_rule.delete',
      resource: 'alert_rule',
      resourceId: req.params.id,
    });

    return res.status(204).send();
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

app.get('/api/audit-log', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await getAuditLog(tenantId, limit);
    return res.json(logs);
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

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'webhook.create',
      resource: 'webhook',
      resourceId: webhook.id,
      metadata: parsed.data,
    });

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

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'webhook.delete',
      resource: 'webhook',
      resourceId: req.params.id,
    });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// Cohort management APIs
app.get('/api/cohorts', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const cohorts = await listCohorts(tenantId);
    return res.json(cohorts);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/cohorts/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const cohort = await getCohort(req.params.id, tenantId);
    if (!cohort) return res.status(404).json({ error: 'not_found' });
    return res.json(cohort);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cohorts', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId, name, journeyId, startsAt, endsAt } = req.body;
    if (!tenantId || !name || !journeyId) {
      return res.status(400).json({ error: 'tenantId, name, and journeyId are required' });
    }
    const cohort = await createCohort(tenantId, name, journeyId, startsAt, endsAt);

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'cohort.create',
      resource: 'cohort',
      resourceId: cohort.id,
      metadata: { name, journeyId, startsAt, endsAt },
    });

    return res.status(201).json(cohort);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/cohorts/:id', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    await deleteCohort(req.params.id, tenantId);

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'cohort.delete',
      resource: 'cohort',
      resourceId: req.params.id,
    });

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/cohorts/:id/members', requireRole('admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const progress = await getCohortProgress(req.params.id, tenantId);
    return res.json(progress);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/cohorts/:id/members', requireRole('admin'), async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds array required' });
    }
    await addCohortMembers(req.params.id, userIds);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/cohorts/:id/members/:userId', requireRole('admin'), async (req, res) => {
  try {
    await removeCohortMember(req.params.id, req.params.userId);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

// CSV export APIs — must be defined before /api/users/:id routes to avoid param capture
app.get('/api/users/export', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const data = await getUsersExportData(tenantId);
    const csv = toCsv(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/users/:id/export', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const data = await getUserExportData(req.params.id, tenantId);
    const csv = toCsv(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="user-${req.params.id}-export.csv"`);
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});


app.post('/api/users/:id/nudge', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    const token = await getTenantWhatsAppToken(tenantId);
    const tenant = await getTenantById(tenantId);
    if (!token || !tenant?.phone_number_id) {
      return res.status(400).json({ error: 'WhatsApp credentials not configured for this tenant' });
    }

    const creds = { accessToken: token, phoneNumberId: tenant.phone_number_id };
    const journeyTitle = 'your journey'; // Could fetch actual title if needed
    const message = `👋 Hey! Ready to continue ${journeyTitle}? Just reply here to pick up where you left off.`;

    await sendTextMessage(user.whatsapp_number, message, creds);
    await logReminder(tenantId, user.id);
    await notifyIdleUser(tenantId, user.id, user.whatsapp_number);

    return res.json({ status: 'ok' });
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

app.get(
  '/api/users/:id/sessions/:sessionId/messages',
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      const messages = await getSessionMessages(req.params.sessionId);
      return res.json(messages);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  },
);

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
        notifyIdleUser(tenantId, user.id, user.whatsapp_number).catch((err) =>
          console.error(`[index] notifyIdleUser failed for ${user.id}: ${err.message}`),
        );
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

    writeAuditLog({
      tenantId: tenant.id,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'tenant.create',
      resource: 'tenant',
      resourceId: tenant.id,
      metadata: parsed.data,
    });

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

    writeAuditLog({
      tenantId: req.params.id,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'tenant.update',
      resource: 'tenant',
      resourceId: req.params.id,
      metadata: parsed.data,
    });

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    await createJourney(tenantId, parsed.data);

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'journey.create',
      resource: 'journey',
      resourceId: parsed.data.id,
      metadata: parsed.data,
    });

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
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

    const existing = await getJourney(tenantId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });

    await updateJourney(tenantId, req.params.id, parsed.data);

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'journey.update',
      resource: 'journey',
      resourceId: req.params.id,
      metadata: parsed.data,
    });

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

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'journey.clone',
      resource: 'journey',
      resourceId: newJourney.id,
      metadata: { sourceJourneyId: req.params.id, title },
    });

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

    writeAuditLog({
      tenantId,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'journey.delete',
      resource: 'journey',
      resourceId: req.params.id,
    });

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
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

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
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

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
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid body', details: parsed.error.issues });

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

app.post('/api/scheduler/run', requireRole('super_admin'), async (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) ?? process.env.DEFAULT_TENANT_ID ?? '';
    if (!tenantId) return res.status(400).json({ error: 'tenantId query param required' });

    const result = await deliverScheduledSteps(tenantId);
    return res.json(result);
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

    writeAuditLog({
      tenantId: req.params.id,
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      action: 'prompt.update',
      resource: 'prompt',
      resourceId: `${req.params.id}:${keyResult.data}`,
      metadata: { key: keyResult.data, content },
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.delete(
  '/api/tenants/:id/prompts/:key',
  requireRole('admin', 'super_admin'),
  async (req, res) => {
    try {
      const keyResult = promptKeySchema.safeParse(req.params.key);
      if (!keyResult.success) {
        return res.status(400).json({ error: 'invalid_prompt_key' });
      }
      await deleteTenantPrompt(req.params.id, keyResult.data);

      writeAuditLog({
        tenantId: req.params.id,
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        action: 'prompt.delete',
        resource: 'prompt',
        resourceId: `${req.params.id}:${keyResult.data}`,
        metadata: { key: keyResult.data },
      });

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  },
);

/** Simple JSON to CSV converter helper. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCsv(data: any[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((obj) =>
    headers
      .map((header) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let val = (obj as any)[header];
        if (val === null || val === undefined) val = '';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

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
