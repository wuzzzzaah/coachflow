import { IWhatsAppAdapter } from '@coachflow/shared';
import { WhatsAppAdapter } from '../whatsapp/sender';
import { SlackAdapter } from '../slack/slackAdapter';

const adapters: Record<string, IWhatsAppAdapter> = {
  whatsapp: WhatsAppAdapter,
  slack: SlackAdapter,
};

export function getAdapter(provider: 'whatsapp' | 'slack'): IWhatsAppAdapter {
  return adapters[provider] || WhatsAppAdapter;
}
