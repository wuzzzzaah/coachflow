import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { parseWebhook } from './parser';
import { handleInbound } from '../engine/flowRouter';
import { MetaWebhookPayload } from './types';
import { getTenantByPhoneNumberId, getTenantWhatsAppToken } from '../db/tenants';

/** GET /webhook/whatsapp — Meta hub challenge verification. */
export function verifyWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[webhook] Verification attempt: mode=${mode}, token=${token}`);

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[webhook] Verification successful');
    res.status(200).send(String(challenge ?? ''));
    return;
  }

  console.warn('[webhook] Verification failed: token mismatch or invalid mode');
  res.sendStatus(403);
}

/**
 * Express middleware — verifies the X-Hub-Signature-256 HMAC header sent by Meta.
 * Must be mounted AFTER express.json({ verify: rawBodyCapture }) so req.rawBody is populated.
 * Rejects with 401 if the signature is missing or invalid.
 */
export function verifySignature(req: Request, res: Response, next: NextFunction): void {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // If no secret is configured, pass through (allows local dev without the env var).
    console.warn('[webhook] WHATSAPP_APP_SECRET not set — signature verification skipped');
    next();
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (!signature) {
    res.status(401).json({ error: 'missing_signature' });
    return;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.status(401).json({ error: 'raw_body_unavailable' });
    return;
  }

  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  let match: boolean;
  try {
    match = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    match = false;
  }

  if (!match) {
    res.status(401).json({ error: 'invalid_signature' });
    return;
  }

  next();
}

/** POST /webhook/whatsapp — Meta inbound messages and status updates. */
export function receiveWebhook(req: Request, res: Response): void {
  // Ack immediately — Meta retries if no 200 within 20 s.
  res.sendStatus(200);

  const payload = req.body as MetaWebhookPayload;
  processAsync(payload).catch((err) => {
    console.error(`[webhook] processing error: ${(err as Error).message}`);
  });
}

async function processAsync(payload: MetaWebhookPayload): Promise<void> {
  const phoneNumberId = payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  let tenantId: string;
  let accessToken: string | undefined;

  if (phoneNumberId) {
    try {
      const tenant = await getTenantByPhoneNumberId(phoneNumberId);
      if (!tenant) {
        console.warn(`[webhook] unknown phone_number_id ${phoneNumberId}, falling back to env`);
        tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';
      } else {
        tenantId = tenant.id;
        const token = await getTenantWhatsAppToken(tenantId).catch(() => null);
        accessToken = token ?? undefined;
      }
    } catch (err) {
      console.error(`[webhook] tenant resolution failed: ${(err as Error).message}`);
      tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';
    }
  } else {
    tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';
  }

  const senderCreds = accessToken && phoneNumberId ? { phoneNumberId, accessToken } : undefined;

  const messages = parseWebhook(payload);
  for (const m of messages) {
    try {
      await handleInbound(m, tenantId, senderCreds);
    } catch (err) {
      console.error(
        `[webhook] handleInbound failed for ${m.whatsappMessageId}: ${(err as Error).message}`,
      );
    }
  }
}
