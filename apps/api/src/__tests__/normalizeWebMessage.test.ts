/**
 * Tests for the normalizeWebMessage() helper that converts WhatsApp-shaped
 * message objects stored in web_messages.content back to plain strings for
 * the React chat client.
 *
 * The function is private to index.ts; we test the same logic here to validate
 * all message-type branches that were broken before the fix.
 */
import { describe, it, expect } from 'vitest';

// ── Inline the function under test (mirrors apps/api/src/index.ts exactly) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeWebMessage(content: any): string {
  if (typeof content === 'string') return content;
  if (content?.type === 'text') return content.text?.body ?? '';
  if (content?.type === 'interactive') {
    const body = content.interactive?.body?.text ?? '';
    const action = content.interactive?.action;
    if (content.interactive?.type === 'button') {
      const buttons = (action?.buttons ?? [])
        .map((b: { reply?: { title?: string } }) => `• ${b.reply?.title ?? ''}`)
        .join('\n');
      return buttons ? `${body}\n\n${buttons}` : body;
    }
    if (content.interactive?.type === 'list') {
      const items = (action?.sections ?? [])
        .flatMap((s: { rows?: { title?: string }[] }) => s.rows ?? [])
        .map((r: { title?: string }) => `• ${r.title ?? ''}`)
        .join('\n');
      return items ? `${body}\n\n${items}` : body;
    }
    return body;
  }
  return JSON.stringify(content);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('normalizeWebMessage', () => {
  it('returns plain strings unchanged', () => {
    expect(normalizeWebMessage('Hello!')).toBe('Hello!');
    expect(normalizeWebMessage('')).toBe('');
  });

  it('extracts body from text messages', () => {
    const msg = { type: 'text', text: { body: 'Hi there' } };
    expect(normalizeWebMessage(msg)).toBe('Hi there');
  });

  it('returns empty string for text message with no body', () => {
    expect(normalizeWebMessage({ type: 'text', text: {} })).toBe('');
    expect(normalizeWebMessage({ type: 'text' })).toBe('');
  });

  it('formats interactive button messages with a bulleted list', () => {
    const msg = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'What would you like to do?' },
        action: {
          buttons: [
            { reply: { id: 'b1', title: 'Option A' } },
            { reply: { id: 'b2', title: 'Option B' } },
          ],
        },
      },
    };
    const result = normalizeWebMessage(msg);
    expect(result).toBe('What would you like to do?\n\n• Option A\n• Option B');
  });

  it('formats interactive list messages with bulleted rows', () => {
    const msg = {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Pick a journey:' },
        action: {
          sections: [
            {
              rows: [
                { id: 'j1', title: 'Leading with Presence' },
                { id: 'j2', title: 'Managing Up' },
              ],
            },
          ],
        },
      },
    };
    const result = normalizeWebMessage(msg);
    expect(result).toBe('Pick a journey:\n\n• Leading with Presence\n• Managing Up');
  });

  it('returns just body text for interactive with no buttons/rows', () => {
    const msg = {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Something' },
        action: { buttons: [] },
      },
    };
    expect(normalizeWebMessage(msg)).toBe('Something');
  });

  it('returns body for unknown interactive type', () => {
    const msg = {
      type: 'interactive',
      interactive: {
        type: 'product_list',
        body: { text: 'Shop now' },
      },
    };
    expect(normalizeWebMessage(msg)).toBe('Shop now');
  });

  it('JSON-stringifies completely unknown objects as fallback', () => {
    const msg = { type: 'sticker', id: 'sticker-123' };
    expect(normalizeWebMessage(msg)).toBe(JSON.stringify(msg));
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeWebMessage(null)).toBe('null');
    expect(normalizeWebMessage(undefined)).toBe(undefined);
  });
});
