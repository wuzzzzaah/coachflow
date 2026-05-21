import crypto from 'node:crypto';
import { Request, Response } from 'express';
import { handleInbound } from '../engine/flowRouter';
import { InboundMessage } from '@coachflow/shared';
import { SlackAdapter } from './slackAdapter';

/**
 * Verify Slack request signature.
 */
export function verifySlackSignature(req: Request, res: Response): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('[slack] SLACK_SIGNING_SECRET not set — skipping verification');
    return true;
  }

  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;

  if (!timestamp || !signature) {
    res.status(401).json({ error: 'missing_signature' });
    return false;
  }

  // Prevent replay attacks
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    res.status(401).json({ error: 'stale_request' });
    return false;
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString();
  if (!rawBody) {
    res.status(401).json({ error: 'raw_body_unavailable' });
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  const expectedSignature = `v0=${hmac.update(sigBaseString).digest('hex')}`;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
      res.status(401).json({ error: 'invalid_signature' });
      return false;
    }
  } catch {
    res.status(401).json({ error: 'invalid_signature' });
    return false;
  }

  return true;
}

export async function receiveSlackWebhook(req: Request, res: Response): Promise<void> {
  if (!verifySlackSignature(req, res)) return;

  const payload = req.body;

  // Handle Slack URL Verification
  if (payload.type === 'url_verification') {
    res.status(200).send(payload.challenge);
    return;
  }

  // Ack immediately
  res.sendStatus(200);

  // Handle Event API
  if (payload.type === 'event_callback') {
    const event = payload.event;

    // Ignore bot messages
    if (event.bot_id || event.subtype === 'bot_message') return;

    if (event.type === 'message' && event.channel_type === 'im') {
      const msg: InboundMessage = {
        whatsappNumber: event.channel, // Using channel ID as the unique identifier for Slack DM
        whatsappMessageId: event.client_msg_id || event.ts,
        displayName: event.user, // Ideally we'd look up the user's name
        kind: 'text',
        provider: 'slack',
        text: event.text,
      };

      const tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';
      await handleInbound(msg, tenantId, new SlackAdapter()).catch((err) => {
        console.error(`[slack] handleInbound failed: ${err.message}`);
      });
    }
  }

  // Handle Interactivity (Button clicks)
  if (payload.payload) {
    const interactive = JSON.parse(payload.payload);
    if (interactive.type === 'block_actions') {
      const action = interactive.actions[0];
      const msg: InboundMessage = {
        whatsappNumber: interactive.channel.id,
        whatsappMessageId: interactive.container.message_ts,
        displayName: interactive.user.id,
        kind: action.action_id.startsWith('list_select_') ? 'list' : 'button',
        provider: 'slack',
        replyId: action.value,
        replyTitle: action.text.text,
        text: action.text.text,
      };

      const tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';
      await handleInbound(msg, tenantId, new SlackAdapter()).catch((err) => {
        console.error(`[slack] handleInbound interactive failed: ${err.message}`);
      });
    }
  }
}
