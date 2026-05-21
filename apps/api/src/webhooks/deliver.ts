import crypto from 'node:crypto';
import { getEnabledWebhooksForEvent } from '../db/webhooks';

export async function deliverEvent(
  tenantId: string,
  event: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    const webhooks = await getEnabledWebhooksForEvent(tenantId, event);
    if (webhooks.length === 0) return;

    const body = JSON.stringify({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      type: event,
      data: payload,
    });

    for (const webhook of webhooks) {
      const hmac = crypto.createHmac('sha256', webhook.secret);
      const digest = hmac.update(body).digest('hex');
      const signature = `sha256=${digest}`;

      // Fire and forget
      fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CoachFlow-Signature': signature,
        },
        body,
      }).catch((err) => {
        console.error(`[webhooks] failed to deliver ${event} to ${webhook.url}:`, err);
      });
    }
  } catch (err) {
    console.error(`[webhooks] deliverEvent error for ${event}:`, err);
  }
}
