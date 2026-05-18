import { ConversationTurn } from '@coachflow/shared';

const MAX_HISTORY_TURNS = 20;

/**
 * Trim the conversation history to a reasonable rolling window before sending
 * to the model. Keeps the most recent turns and drops older ones.
 */
export function trimHistory(history: ConversationTurn[]): ConversationTurn[] {
  if (history.length <= MAX_HISTORY_TURNS) return history;
  return history.slice(-MAX_HISTORY_TURNS);
}

/** Build a readable transcript string (used in step-end summaries). */
export function transcript(history: ConversationTurn[]): string {
  return history.map((t) => `${t.role === 'user' ? 'USER' : 'COACH'}: ${t.content}`).join('\n');
}
