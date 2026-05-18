import axios, { AxiosError } from 'axios';
import { ButtonOption, ListSection } from './types';

const GRAPH_VERSION = 'v19.0';
const MAX_LEN = 4096;

export interface SenderCredentials {
  phoneNumberId: string;
  accessToken: string;
}

function resolveCredentials(creds?: SenderCredentials): SenderCredentials {
  if (creds) return creds;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set');
  if (!accessToken) throw new Error('WHATSAPP_ACCESS_TOKEN is not set');
  return { phoneNumberId, accessToken };
}

async function post(body: object, creds?: SenderCredentials): Promise<void> {
  const { phoneNumberId, accessToken } = resolveCredentials(creds);
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  try {
    await axios.post(url, body, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const axerr = err as AxiosError;
    if (axerr.response?.status === 429) {
      console.warn('[whatsapp] rate limited by Meta (429)');
    }
    const data = axerr.response?.data;
    const summary = typeof data === 'string' ? data : JSON.stringify(data ?? {});
    throw new Error(`Meta send failed (${axerr.response?.status ?? 'no-status'}): ${summary}`);
  }
}

function splitForWhatsApp(text: string): string[] {
  if (text.length <= MAX_LEN) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > MAX_LEN) {
    let cut = remaining.lastIndexOf('\n\n', MAX_LEN);
    if (cut < MAX_LEN / 2) cut = remaining.lastIndexOf('. ', MAX_LEN);
    if (cut < MAX_LEN / 2) cut = MAX_LEN;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendTextMessage(
  to: string,
  text: string,
  creds?: SenderCredentials,
): Promise<void> {
  const parts = splitForWhatsApp(text);
  for (let i = 0; i < parts.length; i++) {
    await post(
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: parts[i] },
      },
      creds,
    );
    if (i < parts.length - 1) await sleep(500);
  }
}

export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: ButtonOption[],
  creds?: SenderCredentials,
): Promise<void> {
  const limited = buttons.slice(0, 3);
  await post(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        action: {
          buttons: limited.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    },
    creds,
  );
}

export async function sendListMessage(
  to: string,
  body: string,
  buttonLabel: string,
  sections: ListSection[],
  creds?: SenderCredentials,
): Promise<void> {
  await post(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body.slice(0, 1024) },
        action: { button: buttonLabel.slice(0, 20), sections },
      },
    },
    creds,
  );
}

export async function markAsRead(messageId: string, creds?: SenderCredentials): Promise<void> {
  try {
    await post({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }, creds);
  } catch (err) {
    console.warn(`[whatsapp] markAsRead failed: ${(err as Error).message}`);
  }
}
