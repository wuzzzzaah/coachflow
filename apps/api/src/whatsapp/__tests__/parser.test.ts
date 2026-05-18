import { describe, it, expect } from 'vitest';
import { parseWebhook } from '../parser';
import type { MetaWebhookPayload } from '../types';

function makePayload(
  overrides: Partial<MetaWebhookPayload['entry'][0]['changes'][0]['value']> = {},
): MetaWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '123' },
              contacts: [{ wa_id: '14155551234', profile: { name: 'Alice' } }],
              ...overrides,
            },
          },
        ],
      },
    ],
  };
}

describe('parseWebhook', () => {
  it('parses a text message', () => {
    const payload = makePayload({
      messages: [
        {
          from: '14155551234',
          id: 'msg-1',
          timestamp: '1000',
          type: 'text',
          text: { body: 'Hello' },
        },
      ],
    });
    const result = parseWebhook(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'text',
      text: 'Hello',
      whatsappNumber: '14155551234',
      displayName: 'Alice',
    });
  });

  it('parses a button_reply interactive message', () => {
    const payload = makePayload({
      messages: [
        {
          from: '14155551234',
          id: 'msg-2',
          timestamp: '1001',
          type: 'interactive',
          interactive: { type: 'button_reply', button_reply: { id: 'btn-1', title: 'Yes' } },
        },
      ],
    });
    const result = parseWebhook(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'button', replyId: 'btn-1', replyTitle: 'Yes' });
  });

  it('parses a list_reply interactive message', () => {
    const payload = makePayload({
      messages: [
        {
          from: '14155551234',
          id: 'msg-3',
          timestamp: '1002',
          type: 'interactive',
          interactive: { type: 'list_reply', list_reply: { id: 'list-1', title: 'Option A' } },
        },
      ],
    });
    const result = parseWebhook(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'list', replyId: 'list-1', replyTitle: 'Option A' });
  });

  it('marks unknown message types as unsupported', () => {
    const payload = makePayload({
      messages: [
        {
          from: '14155551234',
          id: 'msg-4',
          timestamp: '1003',
          type: 'image',
        },
      ] as unknown as MetaWebhookPayload['entry'][0]['changes'][0]['value']['messages'],
    });
    const result = parseWebhook(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'unsupported', unsupportedType: 'image' });
  });

  it('returns empty array for a status-only payload', () => {
    const payload = makePayload({
      statuses: [{ id: 'msg-5', status: 'delivered', recipient_id: '14155551234' }],
    });
    const result = parseWebhook(payload);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for an empty payload', () => {
    expect(parseWebhook({ object: 'whatsapp_business_account', entry: [] })).toHaveLength(0);
  });

  it('returns empty array for null/undefined payload', () => {
    expect(parseWebhook(null as unknown as MetaWebhookPayload)).toHaveLength(0);
  });

  it('sets displayName to undefined when contact not listed', () => {
    const payload = makePayload({
      contacts: [],
      messages: [
        {
          from: '99999',
          id: 'msg-6',
          timestamp: '1004',
          type: 'text',
          text: { body: 'hi' },
        },
      ],
    });
    const result = parseWebhook(payload);
    expect(result[0].displayName).toBeUndefined();
  });
});
