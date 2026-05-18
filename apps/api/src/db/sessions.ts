import { supabase } from './supabaseClient';
import { CoachingMode } from '@coachflow/shared';

/** Start a new session row and return its id. */
export async function startSession(params: {
  userId: string;
  journeyId: string;
  stepId: string;
  mode: CoachingMode;
}): Promise<string> {
  const db = supabase();
  const { data, error } = await db
    .from('sessions')
    .insert({
      user_id: params.userId,
      journey_id: params.journeyId,
      step_id: params.stepId,
      mode: params.mode,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Start session failed: ${error.message}`);
  return data.id as string;
}

/** End a session with an optional summary. */
export async function endSession(sessionId: string, summary?: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('sessions')
    .update({ ended_at: new Date().toISOString(), summary: summary ?? null })
    .eq('id', sessionId);
  if (error) throw new Error(`End session failed: ${error.message}`);
}

/** Append a message to the conversation log for a session. */
export async function logMessage(params: {
  sessionId: string;
  userId: string;
  whatsappMessageId?: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<void> {
  const db = supabase();
  const { error } = await db.from('messages').insert({
    session_id: params.sessionId,
    user_id: params.userId,
    whatsapp_message_id: params.whatsappMessageId ?? null,
    role: params.role,
    content: params.content,
  });
  if (error) throw new Error(`Log message failed: ${error.message}`);
  // Note: message_count on sessions is left at default in this prototype.
  // If needed, add a Postgres trigger or RPC to increment it on insert.
}

export async function getSessionMessages(sessionId: string) {
  const db = supabase();
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Get session messages failed: ${error.message}`);
  return data ?? [];
}
