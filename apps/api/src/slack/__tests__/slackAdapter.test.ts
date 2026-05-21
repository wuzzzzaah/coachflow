import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import axios from 'axios';
import { SlackAdapter } from '../slackAdapter';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('Slack Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SLACK_BOT_TOKEN = 'test-bot-token';
  });

  it('sendTextMessage calls chat.postMessage', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });

    await SlackAdapter.sendTextMessage('C123', 'Hello Slack');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      { channel: 'C123', text: 'Hello Slack' },
      expect.any(Object),
    );
  });

  it('sendButtonMessage renders blocks', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });

    await SlackAdapter.sendButtonMessage('C123', 'Pick one', [
      { id: 'opt1', title: 'Option 1' },
    ]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        channel: 'C123',
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'actions' }),
        ]),
      }),
      expect.any(Object),
    );
  });

  it('sendListMessage renders blocks', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });

    await SlackAdapter.sendListMessage('C123', 'Choose journey', 'Select', [
      {
        title: 'Section 1',
        rows: [{ id: 'j1', title: 'Journey 1' }],
      },
    ]);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'header' }),
          expect.objectContaining({ type: 'actions' }),
        ]),
      }),
      expect.any(Object),
    );
  });
});
