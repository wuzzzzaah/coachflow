import { supabase } from './supabaseClient';

/**
 * getActiveSessions(tenantId, windowMinutes) — users with a session updated in the last N minutes.
 */
export async function getActiveSessions(tenantId: string, windowMinutes: number = 30): Promise<number> {
  const db = supabase();
  const threshold = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('sessions')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .is('ended_at', null)
    .gte('updated_at', threshold);

  if (error) throw new Error(`getActiveSessions failed: ${error.message}`);

  const uniqueUsers = new Set(data?.map(s => s.user_id));
  return uniqueUsers.size;
}

/**
 * getStepDropOff(tenantId, journeyId) — per-step completion counts -> drop-off % array.
 * Returns array of { stepIndex, reached, dropped, dropRate }.
 */
export async function getStepDropOff(tenantId: string, journeyId: string) {
  const db = supabase();

  // 1. Get all steps for the journey
  const { data: steps, error: stepsErr } = await db
    .from('journey_steps')
    .select('id, step_index')
    .eq('tenant_id', tenantId)
    .eq('journey_id', journeyId)
    .is('deleted_at', null)
    .order('step_index', { ascending: true });

  if (stepsErr) throw new Error(`Failed to fetch steps: ${stepsErr.message}`);

  // 2. Get all sessions for this journey
  const { data: sessions, error: sessionsErr } = await db
    .from('sessions')
    .select('user_id, step_id, ended_at')
    .eq('tenant_id', tenantId)
    .eq('journey_id', journeyId);

  if (sessionsErr) throw new Error(`Failed to fetch sessions: ${sessionsErr.message}`);

  // 3. Calculate metrics per step
  return steps.map(step => {
    const stepSessions = sessions.filter(s => s.step_id === step.id);
    const reachedUsers = new Set(stepSessions.map(s => s.user_id));
    const completedUsers = new Set(stepSessions.filter(s => s.ended_at !== null).map(s => s.user_id));

    const reached = reachedUsers.size;
    const completed = completedUsers.size;
    const dropped = reached - completed;
    const dropRate = reached > 0 ? Math.round((dropped / reached) * 100) : 0;

    return {
      stepIndex: step.step_index,
      reached,
      dropped,
      dropRate
    };
  });
}

/**
 * getStuckUsers(tenantId, thresholdHours) — users whose updated_at on user_journeys is older than N hours and journey is in_progress (active).
 * Returns array of user IDs + hours idle.
 */
export async function getStuckUsers(tenantId: string, thresholdHours: number = 24) {
  const db = supabase();
  const threshold = new Date(Date.now() - thresholdHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('user_journeys')
    .select(`
      user_id,
      updated_at,
      users:user_id (display_name, whatsapp_number),
      journeys:journey_id (title)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .lt('updated_at', threshold);

  if (error) throw new Error(`getStuckUsers failed: ${error.message}`);

  return (data || []).map((uj: any) => {
    const lastUpdate = new Date(uj.updated_at).getTime();
    const hoursIdle = Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60));
    return {
      userId: uj.user_id,
      hoursIdle,
      userName: uj.users?.display_name || 'Unknown',
      whatsappNumber: uj.users?.whatsapp_number || 'Unknown',
      journeyTitle: uj.journeys?.title || 'Unknown',
    };
  });
}
