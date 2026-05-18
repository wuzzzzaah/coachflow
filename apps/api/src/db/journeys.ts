import { supabase } from './supabaseClient';

/** Find or create an active user_journey row for this user + journey. */
export async function ensureUserJourney(
  userId: string,
  journeyId: string,
): Promise<{ id: string; currentStepIndex: number; status: string }> {
  const db = supabase();
  const existing = await db
    .from('user_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .maybeSingle();
  if (existing.error) throw new Error(`Lookup user_journey failed: ${existing.error.message}`);

  if (existing.data) {
    return {
      id: existing.data.id as string,
      currentStepIndex: existing.data.current_step_index as number,
      status: existing.data.status as string,
    };
  }
  const insert = await db
    .from('user_journeys')
    .insert({ user_id: userId, journey_id: journeyId })
    .select('*')
    .single();
  if (insert.error) throw new Error(`Create user_journey failed: ${insert.error.message}`);
  return {
    id: insert.data.id as string,
    currentStepIndex: insert.data.current_step_index as number,
    status: insert.data.status as string,
  };
}

export async function advanceUserJourney(
  userJourneyId: string,
  nextStepIndex: number,
): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('user_journeys')
    .update({ current_step_index: nextStepIndex })
    .eq('id', userJourneyId);
  if (error) throw new Error(`Advance user_journey failed: ${error.message}`);
}

export async function completeUserJourney(userJourneyId: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('user_journeys')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', userJourneyId);
  if (error) throw new Error(`Complete user_journey failed: ${error.message}`);
}
