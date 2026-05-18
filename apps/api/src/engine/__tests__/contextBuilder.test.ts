import { describe, it, expect } from 'vitest';
import { trimHistory, transcript } from '../contextBuilder';
import type { ConversationTurn } from '@coachflow/shared';

function makeTurns(n: number): ConversationTurn[] {
  return Array.from(
    { length: n },
    (_, i) =>
      ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i + 1}`,
      }) as ConversationTurn,
  );
}

describe('trimHistory', () => {
  it('returns history unchanged when at or below 20 turns', () => {
    const turns = makeTurns(20);
    expect(trimHistory(turns)).toHaveLength(20);
    expect(trimHistory(turns)).toBe(turns);
  });

  it('trims to 20 most-recent turns when over boundary', () => {
    const turns = makeTurns(25);
    const result = trimHistory(turns);
    expect(result).toHaveLength(20);
    expect(result[0].content).toBe('turn 6');
    expect(result[19].content).toBe('turn 25');
  });

  it('returns empty array for empty input', () => {
    expect(trimHistory([])).toHaveLength(0);
  });

  it('does not mutate the original array', () => {
    const turns = makeTurns(22);
    const copy = [...turns];
    trimHistory(turns);
    expect(turns).toEqual(copy);
  });
});

describe('transcript', () => {
  it('formats user and assistant turns correctly', () => {
    const turns: ConversationTurn[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const result = transcript(turns);
    expect(result).toBe('USER: Hello\nCOACH: Hi there');
  });

  it('returns empty string for empty history', () => {
    expect(transcript([])).toBe('');
  });
});
