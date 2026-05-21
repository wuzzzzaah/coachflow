import axios from 'axios';
import { IWhatsAppAdapter, ButtonOption, ListSection } from '@coachflow/shared';

export interface SlackCredentials {
  botToken: string;
}

function resolveCredentials(creds?: SlackCredentials): SlackCredentials {
  if (creds?.botToken) return creds;
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) throw new Error('SLACK_BOT_TOKEN is not set');
  return { botToken };
}

async function post(method: string, body: object, creds?: SlackCredentials): Promise<void> {
  const { botToken } = resolveCredentials(creds);
  const url = `https://slack.com/api/${method}`;
  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
    if (res.data && res.data.ok === false) {
      throw new Error(`Slack API error: ${res.data.error}`);
    }
  } catch (err) {
    console.error(`[slack] ${method} failed:`, (err as Error).message);
    throw err;
  }
}

export async function sendTextMessage(
  to: string,
  text: string,
  creds?: SlackCredentials,
): Promise<void> {
  await post('chat.postMessage', { channel: to, text }, creds);
}

export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: ButtonOption[],
  creds?: SlackCredentials,
): Promise<void> {
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body },
    },
    {
      type: 'actions',
      elements: buttons.map((b) => ({
        type: 'button',
        text: { type: 'plain_text', text: b.title.slice(0, 75) },
        value: b.id,
        action_id: `button_click_${b.id}`,
      })),
    },
  ];
  await post('chat.postMessage', { channel: to, text: body, blocks }, creds);
}

export async function sendListMessage(
  to: string,
  body: string,
  buttonLabel: string,
  sections: ListSection[],
  creds?: SlackCredentials,
): Promise<void> {
  const blocks: any[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body },
    },
  ];

  for (const section of sections) {
    if (section.title) {
      blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: section.title.slice(0, 3000) },
      });
    }
    const elements = section.rows.map((row) => ({
      type: 'button',
      text: {
        type: 'plain_text',
        text: `${row.title}${row.description ? ` (${row.description})` : ''}`.slice(0, 75),
      },
      value: row.id,
      action_id: `list_select_${row.id}`,
    }));

    // Slack allows max 25 elements in actions block, but let's be safe and chunk them if needed.
    // For now, assuming reasonable number of journeys.
    blocks.push({
      type: 'actions',
      elements,
    });
  }

  await post('chat.postMessage', { channel: to, text: body, blocks }, creds);
}

export async function sendMediaMessage(
  to: string,
  mediaType: 'image' | 'document' | 'audio' | 'video',
  mediaUrl: string,
  caption?: string,
  creds?: SlackCredentials,
): Promise<void> {
  if (mediaType === 'image') {
    await post(
      'chat.postMessage',
      {
        channel: to,
        text: caption || 'Image',
        blocks: [
          {
            type: 'image',
            image_url: mediaUrl,
            alt_text: caption || 'Image',
            title: caption ? { type: 'plain_text', text: caption.slice(0, 2000) } : undefined,
          },
        ],
      },
      creds,
    );
  } else {
    // For other media types, just send the link in a text message.
    // Slack will often unfurl these.
    const text = caption ? `${caption}\n${mediaUrl}` : mediaUrl;
    await sendTextMessage(to, text, creds);
  }
}

export async function markAsRead(): Promise<void> {
  // No-op for Slack
}

export const SlackAdapter: IWhatsAppAdapter = {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  sendMediaMessage,
  markAsRead,
};
