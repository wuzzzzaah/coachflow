import { MetaWebhookPayload, InboundMessage } from './types';

/**
 * Extract normalised inbound messages from a Meta webhook payload.
 * Status updates and empty payloads return an empty array.
 */
export function parseWebhook(payload: MetaWebhookPayload): InboundMessage[] {
  const out: InboundMessage[] = [];
  if (!payload?.entry) return out;

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const messages = value.messages;
      if (!messages || messages.length === 0) continue;
      const contacts = value.contacts ?? [];
      const nameByNumber = new Map(contacts.map((c) => [c.wa_id, c.profile?.name]));

      for (const msg of messages) {
        const displayName = nameByNumber.get(msg.from);
        if (msg.type === 'text') {
          out.push({
            whatsappNumber: msg.from,
            whatsappMessageId: msg.id,
            displayName,
            kind: 'text',
            text: msg.text.body,
          });
        } else if (msg.type === 'interactive') {
          const ir = msg.interactive;
          if (ir.type === 'button_reply' && ir.button_reply) {
            out.push({
              whatsappNumber: msg.from,
              whatsappMessageId: msg.id,
              displayName,
              kind: 'button',
              replyId: ir.button_reply.id,
              replyTitle: ir.button_reply.title,
              text: ir.button_reply.title,
            });
          } else if (ir.type === 'list_reply' && ir.list_reply) {
            out.push({
              whatsappNumber: msg.from,
              whatsappMessageId: msg.id,
              displayName,
              kind: 'list',
              replyId: ir.list_reply.id,
              replyTitle: ir.list_reply.title,
              text: ir.list_reply.title,
            });
          }
        } else {
          out.push({
            whatsappNumber: msg.from,
            whatsappMessageId: msg.id,
            displayName,
            kind: 'unsupported',
            unsupportedType: msg.type,
          });
        }
      }
    }
  }
  return out;
}
