import { IWhatsAppAdapter, ButtonOption, ListSection, InboundMessage } from '@coachflow/shared';
import crypto from 'node:crypto';
import { storeOutboundWebMessage } from '../db/webMessages';

export class WebAdapter implements IWhatsAppAdapter {
  constructor(
    private tenantId: string,
    private userId: string,
  ) {}

  static parseInbound(body: {
    userId: string;
    text?: string;
    kind?: string;
    replyId?: string;
  }): InboundMessage {
    return {
      whatsappNumber: body.userId,
      whatsappMessageId: crypto.randomUUID(),
      kind: (body.kind as 'text' | 'button' | 'list' | 'unsupported') ?? 'text',
      provider: 'web',
      text: body.text,
      replyId: body.replyId,
    };
  }

  async sendTextMessage(to: string, text: string): Promise<void> {
    await storeOutboundWebMessage(this.tenantId, this.userId, {
      type: 'text',
      text: { body: text },
    });
  }

  async sendMediaMessage(
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaUrl: string,
    caption?: string,
  ): Promise<void> {
    await storeOutboundWebMessage(this.tenantId, this.userId, {
      type: mediaType,
      [mediaType]: { link: mediaUrl, caption },
    });
  }

  async sendButtonMessage(to: string, body: string, buttons: ButtonOption[]): Promise<void> {
    await storeOutboundWebMessage(this.tenantId, this.userId, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    });
  }

  async sendListMessage(
    to: string,
    body: string,
    buttonLabel: string,
    sections: ListSection[],
  ): Promise<void> {
    await storeOutboundWebMessage(this.tenantId, this.userId, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: buttonLabel,
          sections,
        },
      },
    });
  }

  async markAsRead(_messageId: string): Promise<void> {
    // No-op for web channel
  }
}
