import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { receiveSlackWebhook } from '../webhook';
import { handleInbound } from '../../engine/flowRouter';

vi.mock('../../engine/flowRouter', () => ({
  handleInbound: vi.fn().mockResolvedValue(undefined),
}));

describe('Slack Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_SIGNING_SECRET = 'test-secret';
  });

  function mockReq(body: any, headers: any = {}) {
    return {
      body,
      headers,
      rawBody: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)),
    } as any;
  }

  function mockRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    res.sendStatus = vi.fn().mockReturnValue(res);
    return res;
  }

  it('rejects invalid signatures', async () => {
    const req = mockReq({ type: 'url_verification' }, {
      'x-slack-request-timestamp': Math.floor(Date.now() / 1000).toString(),
      'x-slack-signature': 'v0=invalid',
    });
    const res = mockRes();

    await receiveSlackWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('verifies valid signatures', async () => {
    const body = { type: 'url_verification', challenge: 'ch123' };
    const rawBody = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigBaseString = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', 'test-secret');
    const signature = `v0=${hmac.update(sigBaseString).digest('hex')}`;

    const req = mockReq(body, {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    });
    const res = mockRes();

    await receiveSlackWebhook(req, res);
    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('ch123');
  });

  it('routes DM message to handleInbound', async () => {
    const body = {
      type: 'event_callback',
      event: {
        type: 'message',
        channel: 'D123',
        channel_type: 'im',
        user: 'U123',
        text: 'Hello coach',
        client_msg_id: 'msg123',
      },
    };
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmac = crypto.createHmac('sha256', 'test-secret');
    const signature = `v0=${hmac.update(`v0:${timestamp}:${JSON.stringify(body)}`).digest('hex')}`;

    const req = mockReq(body, {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    });
    const res = mockRes();

    await receiveSlackWebhook(req, res);
    expect(handleInbound).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappNumber: 'D123',
        text: 'Hello coach',
        provider: 'slack',
      }),
      expect.any(String),
    );
  });
});
