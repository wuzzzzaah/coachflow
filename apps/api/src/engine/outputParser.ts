import { AIResponse, AIScore } from '@coachflow/shared';

const FALLBACK_MESSAGE = "I didn't quite catch that. Could you rephrase?";

function tryParseJSON(raw: string): unknown {
  // Some models occasionally wrap JSON in markdown fences despite instructions.
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract the first JSON object substring.
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isScore(v: unknown): v is AIScore {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    Array.isArray(s.dimensions) &&
    typeof s.overall === 'number' &&
    typeof s.summary === 'string' &&
    typeof s.developmentFocus === 'string'
  );
}

/**
 * Parse a raw Gemini text response into a validated AIResponse.
 * Returns a safe fallback if the response is missing or malformed (and logs the raw text).
 */
export function parseAIResponse(raw: string): AIResponse {
  const parsed = tryParseJSON(raw);
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[outputParser] invalid JSON from AI:', raw.slice(0, 500));
    return {
      message: FALLBACK_MESSAGE,
      intent: 'unknown',
      shouldAdvance: false,
    };
  }
  const obj = parsed as Record<string, unknown>;
  const message =
    typeof obj.message === 'string' && obj.message.trim().length > 0
      ? obj.message
      : FALLBACK_MESSAGE;
  const intent = typeof obj.intent === 'string' ? obj.intent : 'unknown';
  const shouldAdvance = obj.shouldAdvance === true;
  const score = isScore(obj.score) ? (obj.score as AIScore) : null;
  const suggestedQuickReplies =
    Array.isArray(obj.suggestedQuickReplies) &&
    obj.suggestedQuickReplies.every((s) => typeof s === 'string')
      ? (obj.suggestedQuickReplies as string[]).slice(0, 3)
      : null;
  return { message, intent, shouldAdvance, score, suggestedQuickReplies };
}
