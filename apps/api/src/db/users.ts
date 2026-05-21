import { supabase } from './supabaseClient';
import { UserRecord } from '@coachflow/shared';

/**
 * Find a user by their WhatsApp number, or create one if not present.
 * Returns the user record and a boolean indicating whether it was just created.
 */
export async function upsertUser(
  whatsappNumber: string,
  displayName?: string,
): Promise<{ user: UserRecord; created: boolean }> {
  const db = supabase();
  const existing = await db
    .from('users')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Lookup user failed: ${existing.error.message}`);
  }
  if (existing.data) {
    return { user: existing.data as UserRecord, created: false };
  }

  const insert = await db
    .from('users')
    .insert({ whatsapp_number: whatsappNumber, display_name: displayName ?? null })
    .select('*')
    .single();
  if (insert.error) {
    throw new Error(`Create user failed: ${insert.error.message}`);
  }
  return { user: insert.data as UserRecord, created: true };
}

/** Update the current journey/step pointers on the user record. */
export async function updateUserProgress(
  userId: string,
  journeyId: string | null,
  stepIndex: number,
): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('users')
    .update({
      current_journey_id: journeyId,
      current_step_index: stepIndex,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw new Error(`Update user progress failed: ${error.message}`);
}

/** Mark a user as onboarded (first time they interact). */
export async function markOnboarded(userId: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('users')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error(`Mark onboarded failed: ${error.message}`);
}

/**
 * Atomically claim a Meta message ID for processing.
 * Returns true if this is the first time we've seen it, false if duplicate.
 */
export async function claimMessage(whatsappMessageId: string): Promise<boolean> {
  const db = supabase();
  const { error } = await db
    .from('processed_messages')
    .insert({ whatsapp_message_id: whatsappMessageId });
  if (!error) return true;
  // Postgres unique-violation code is 23505
  if (error.code === '23505') return false;
  throw new Error(`Claim message failed: ${error.message}`);
}

export async function getUserByNumber(whatsappNumber: string): Promise<UserRecord | null> {
  const db = supabase();
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .maybeSingle();
  if (error) throw new Error(`Get user failed: ${error.message}`);
  return (data as UserRecord) ?? null;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const db = supabase();
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`Get user failed: ${error.message}`);
  return (data as UserRecord) ?? null;
}

export async function searchUsers(tenantId: string, query?: string) {
  const db = supabase();
  let qb = db
    .from('users')
    .select('id, display_name, whatsapp_number, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (query) {
    qb = qb.or(`display_name.ilike.%${query}%,whatsapp_number.ilike.%${query}%`);
  }

  const { data, error } = await qb;
  if (error) throw new Error(`Search users failed: ${error.message}`);

  return data.map(u => ({
    id: u.id,
    name: u.display_name,
    whatsapp_number: u.whatsapp_number,
    created_at: u.created_at,
  }));
}

export async function getUserProgress(tenantId: string, userId: string) {
  const db = supabase();

  // Fetch unique journeys the user has sessions for
  const { data: sessions, error: sessionsError } = await db
    .from('sessions')
    .select('journey_id, ended_at, started_at, step_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId);

  if (sessionsError) {
    throw new Error(`Get user sessions failed: ${sessionsError.message}`);
  }

  if (!sessions || sessions.length === 0) {
    return [];
  }

  // Get distinct journeys
  const journeyIds = Array.from(new Set(sessions.map((s) => s.journey_id).filter(Boolean))) as string[];

  if (journeyIds.length === 0) {
    return [];
  }

  const { data: journeys, error: journeysError } = await db
    .from('journeys')
    .select('id, title')
    .in('id', journeyIds)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (journeysError) {
    throw new Error(`Get journeys failed: ${journeysError.message}`);
  }

  const { data: steps, error: stepsError } = await db
    .from('journey_steps')
    .select('journey_id, id')
    .in('journey_id', journeyIds)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (stepsError) {
    throw new Error(`Get journey steps failed: ${stepsError.message}`);
  }

  const progress = journeys.map((j) => {
    const journeySessions = sessions.filter((s) => s.journey_id === j.id);
    const completedSessions = journeySessions.filter((s) => s.ended_at !== null);
    // Unique completed steps
    const completedStepIds = new Set(completedSessions.map(s => s.step_id).filter(Boolean));

    // Sort descending by started_at or ended_at to find last active
    const sortedSessions = [...journeySessions].sort((a, b) => {
      const timeA = new Date(a.ended_at || a.started_at).getTime();
      const timeB = new Date(b.ended_at || b.started_at).getTime();
      return timeB - timeA;
    });
    const lastActivity = sortedSessions.length > 0 ? (sortedSessions[0].ended_at || sortedSessions[0].started_at) : null;

    const journeySteps = steps.filter(step => step.journey_id === j.id);

    return {
      journey_id: j.id,
      journey_title: j.title,
      completed_steps: completedStepIds.size,
      total_steps: journeySteps.length,
      last_active_at: lastActivity
    };
  });

  return progress;
}
