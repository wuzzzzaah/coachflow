import { describe, it, expect } from 'vitest';
import { parseAIResponse } from '../outputParser';

const FALLBACK = "I didn't quite catch that. Could you rephrase?";

describe('parseAIResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({ message: 'Good job.', intent: 'affirm', shouldAdvance: false });
    const result = parseAIResponse(raw);
    expect(result.message).toBe('Good job.');
    expect(result.intent).toBe('affirm');
    expect(result.shouldAdvance).toBe(false);
  });

  it('parses a markdown-fenced JSON response', () => {
    const raw = '```json\n{"message":"Hello","intent":"greet","shouldAdvance":true}\n```';
    const result = parseAIResponse(raw);
    expect(result.message).toBe('Hello');
    expect(result.shouldAdvance).toBe(true);
  });

  it('falls back when JSON is completely missing', () => {
    const result = parseAIResponse('This is not JSON at all.');
    expect(result.message).toBe(FALLBACK);
    expect(result.intent).toBe('unknown');
    expect(result.shouldAdvance).toBe(false);
  });

  it('falls back when required fields are absent', () => {
    const result = parseAIResponse(JSON.stringify({ foo: 'bar' }));
    expect(result.message).toBe(FALLBACK);
  });

  it('falls back on empty string', () => {
    expect(parseAIResponse('').message).toBe(FALLBACK);
  });

  it('parses a valid score block', () => {
    const raw = JSON.stringify({
      message: 'Assessment complete.',
      intent: 'score',
      shouldAdvance: true,
      score: {
        overall: 72,
        summary: 'Good effort.',
        developmentFocus: 'Listen more.',
        dimensions: [{ name: 'Self-Awareness', score: 70, evidence: 'Reflected well.' }],
      },
    });
    const result = parseAIResponse(raw);
    expect(result.score?.overall).toBe(72);
    expect(result.score?.dimensions).toHaveLength(1);
  });

  it('ignores an invalid score block', () => {
    const raw = JSON.stringify({
      message: 'done',
      intent: 'end',
      shouldAdvance: true,
      score: { bad: true },
    });
    const result = parseAIResponse(raw);
    expect(result.score).toBeNull();
  });

  it('parses suggestedQuickReplies up to 3 items', () => {
    const raw = JSON.stringify({
      message: 'Choose one.',
      intent: 'prompt',
      shouldAdvance: false,
      suggestedQuickReplies: ['A', 'B', 'C', 'D'],
    });
    const result = parseAIResponse(raw);
    expect(result.suggestedQuickReplies).toEqual(['A', 'B', 'C']);
  });

  it('ignores suggestedQuickReplies if not all strings', () => {
    const raw = JSON.stringify({
      message: 'ok',
      intent: 'x',
      shouldAdvance: false,
      suggestedQuickReplies: ['A', 2, 'C'],
    });
    expect(parseAIResponse(raw).suggestedQuickReplies).toBeNull();
  });

  it('extracts JSON embedded in surrounding text', () => {
    const raw =
      'Here is the response: {"message":"Embedded","intent":"test","shouldAdvance":false} end';
    const result = parseAIResponse(raw);
    expect(result.message).toBe('Embedded');
  });
});
