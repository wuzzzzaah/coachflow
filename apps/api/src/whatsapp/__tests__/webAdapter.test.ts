import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebAdapter } from '../webAdapter';
import { storeOutboundWebMessage } from '../../db/webMessages';

vi.mock('../../db/webMessages', () => ({
  storeOutboundWebMessage: vi.fn().mockResolvedValue(undefined),
  pollAndClearWebMessages: vi.fn(),
}));

describe('WebAdapter', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-456';
  const adapter = new WebAdapter(tenantId, userId);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores text messages', async () => {
    await adapter.sendTextMessage('to-field-ignored', 'Hello world');
    expect(storeOutboundWebMessage).toHaveBeenCalledWith(tenantId, userId, {
      type: 'text',
      text: { body: 'Hello world' },
    });
  });

  it('stores media messages', async () => {
    await adapter.sendMediaMessage('to', 'image', 'https://example.com/img.png', 'A cool image');
    expect(storeOutboundWebMessage).toHaveBeenCalledWith(tenantId, userId, {
      type: 'image',
      image: { link: 'https://example.com/img.png', caption: 'A cool image' },
    });
  });

  it('stores button messages', async () => {
    const buttons = [{ id: 'b1', title: 'Yes' }, { id: 'b2', title: 'No' }];
    await adapter.sendButtonMessage('to', 'Are you sure?', buttons);
    expect(storeOutboundWebMessage).toHaveBeenCalledWith(tenantId, userId, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Are you sure?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'b1', title: 'Yes' } },
            { type: 'reply', reply: { id: 'b2', title: 'No' } },
          ],
        },
      },
    });
  });

  it('stores list messages', async () => {
    const sections = [{ title: 'S1', rows: [{ id: 'r1', title: 'Row 1' }] }];
    await adapter.sendListMessage('to', 'Pick one', 'Select', sections);
    expect(storeOutboundWebMessage).toHaveBeenCalledWith(tenantId, userId, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Pick one' },
        action: {
          button: 'Select',
          sections,
        },
      },
    });
  });
});
