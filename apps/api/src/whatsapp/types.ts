import { InboundMessage, ButtonOption, ListSection } from '@coachflow/shared';

/**
 * Meta WhatsApp Cloud API webhook payload types.
 * Only the subset we consume is modelled here.
 */

export interface MetaTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
}

export interface MetaInteractiveMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'interactive';
  interactive: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

export interface MetaUnsupportedMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'audio' | 'image' | 'document' | 'video' | 'sticker' | 'location' | 'contacts';
}

export type MetaMessage = MetaTextMessage | MetaInteractiveMessage | MetaUnsupportedMessage;

export interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipient_id: string;
}

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: { phone_number_id: string };
        contacts?: MetaContact[];
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
      };
      field: 'messages';
    }>;
  }>;
}

export { InboundMessage, ButtonOption, ListSection };
