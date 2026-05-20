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

/** Find the most recent un-ended session for a user. */
export async function getLatestActiveSession(userId: string) {
  const db = supabase();
  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Get latest active session failed: ${error.message}`);
  return data;
}

export async function getSessionById(tenantId: string, sessionId: string) {
  const db = supabase();
  const { data: session, error } = await db
    .from('sessions')
    .select('id, journey_id, step_id, mode, started_at, ended_at, message_count')
    .eq('tenant_id', tenantId)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw new Error(`Get session failed: ${error.message}`);
  if (!session) return null;

  const [{ data: journeys }, { data: steps }] = await Promise.all([
    db.from('journeys').select('id, title').eq('id', session.journey_id).eq('tenant_id', tenantId).maybeSingle(),
    db.from('journey_steps').select('id, title').eq('id', session.step_id).eq('tenant_id', tenantId).maybeSingle(),
  ]);

  return {
    id: session.id,
    journey_id: session.journey_id,
    journey_title: (journeys as any)?.title || 'Unknown Journey',
    step_id: session.step_id,
    step_title: (steps as any)?.title || 'Unknown Step',
    mode: session.mode,
    started_at: session.started_at,
    ended_at: session.ended_at,
    message_count: session.message_count,
  };
}

export async function getUserSessions(tenantId: string, userId: string) {
  const db = supabase();
  const { data: sessions, error: sessionsError } = await db
    .from('sessions')
    .select('id, journey_id, step_id, mode, started_at, ended_at, message_count')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (sessionsError) throw new Error(`Get user sessions failed: ${sessionsError.message}`);
  if (!sessions || sessions.length === 0) return [];

  const journeyIds = Array.from(new Set(sessions.map(s => s.journey_id).filter(Boolean))) as string[];
  const stepIds = Array.from(new Set(sessions.map(s => s.step_id).filter(Boolean))) as string[];

  const [{ data: journeys }, { data: steps }] = await Promise.all([
    db.from('journeys').select('id, title').in('id', journeyIds).eq('tenant_id', tenantId),
    db.from('journey_steps').select('id, title').in('id', stepIds).eq('tenant_id', tenantId),
  ]);

  const journeyMap = new Map(journeys?.map(j => [j.id, j.title]));
  const stepMap = new Map(steps?.map(s => [s.id, s.title]));

  return sessions.map(s => ({
    id: s.id,
    journey_id: s.journey_id,
    journey_title: journeyMap.get(s.journey_id!) || 'Unknown Journey',
    step_id: s.step_id,
    step_title: stepMap.get(s.step_id!) || 'Unknown Step',
    mode: s.mode,
    started_at: s.started_at,
    ended_at: s.ended_at,
    message_count: s.message_count,
  }));
}
