import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { sendMediaMessage } from '../sender';

vi.mock('axios');
const mockedAxios = axios as vi.Mocked<typeof axios>;

describe('WhatsApp Sender - sendMediaMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  });

  it('sends an image message with correct payload', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    await sendMediaMessage('123456789', 'image', 'https://example.com/image.png', 'Caption text');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/test-phone-id/messages',
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '123456789',
        type: 'image',
        image: {
          link: 'https://example.com/image.png',
          caption: 'Caption text',
        },
      },
      expect.any(Object)
    );
  });

  it('sends an audio message without caption (audio does not support captions)', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    await sendMediaMessage('123456789', 'audio', 'https://example.com/audio.mp3', 'Ignored caption');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/test-phone-id/messages',
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '123456789',
        type: 'audio',
        audio: {
          link: 'https://example.com/audio.mp3',
        },
      },
      expect.any(Object)
    );
  });

  it('sends a document message with caption', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    await sendMediaMessage('123456789', 'document', 'https://example.com/doc.pdf', 'Worksheet');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/test-phone-id/messages',
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '123456789',
        type: 'document',
        document: {
          link: 'https://example.com/doc.pdf',
          caption: 'Worksheet',
        },
      },
      expect.any(Object)
    );
  });

  it('sends a video message with caption', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    await sendMediaMessage('123456789', 'video', 'https://example.com/video.mp4', 'Watch this');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/test-phone-id/messages',
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '123456789',
        type: 'video',
        video: {
          link: 'https://example.com/video.mp4',
          caption: 'Watch this',
        },
      },
      expect.any(Object)
    );
  });

  it('uses provided credentials instead of env vars', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });

    const creds = { phoneNumberId: 'custom-id', accessToken: 'custom-token' };
    await sendMediaMessage('123456789', 'image', 'https://example.com/img.png', undefined, creds);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://graph.facebook.com/v19.0/custom-id/messages',
      expect.any(Object),
      {
        headers: {
          Authorization: 'Bearer custom-token',
          'Content-Type': 'application/json',
        },
      }
    );
  });
});
