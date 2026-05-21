import {
  IWhatsAppAdapter,
  ButtonOption,
  ListSection,
} from '@coachflow/shared';
import * as sender from './sender';

export class WhatsAppAdapter implements IWhatsAppAdapter {
  constructor(private creds?: sender.SenderCredentials) {}

  async sendTextMessage(to: string, text: string): Promise<void> {
    await sender.sendTextMessage(to, text, this.creds);
  }

  async sendMediaMessage(
    to: string,
    mediaType: 'image' | 'document' | 'audio' | 'video',
    mediaUrl: string,
    caption?: string,
  ): Promise<void> {
    await sender.sendMediaMessage(to, mediaType, mediaUrl, caption, this.creds);
  }

  async sendButtonMessage(to: string, body: string, buttons: ButtonOption[]): Promise<void> {
    await sender.sendButtonMessage(to, body, buttons, this.creds);
  }

  async sendListMessage(
    to: string,
    body: string,
    buttonLabel: string,
    sections: ListSection[],
  ): Promise<void> {
    await sender.sendListMessage(to, body, buttonLabel, sections, this.creds);
  }

  async markAsRead(messageId: string): Promise<void> {
    await sender.markAsRead(messageId, this.creds);
  }
}
