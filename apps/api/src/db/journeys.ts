import crypto from 'node:crypto';
import { supabase } from './supabaseClient';
import { JourneyRow, JourneyStepRow } from '@coachflow/shared';

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

export async function listTemplates(tenantId: string): Promise<JourneyRow[]> {
  const db = supabase();
  const { data, error } = await db
    .from('journeys')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_template', true)
    .is('deleted_at', null);

  if (error) throw new Error(`List templates failed: ${error.message}`);
  return data as JourneyRow[];
}

export async function cloneJourney(
  sourceId: string,
  tenantId: string,
  title?: string,
): Promise<JourneyRow> {
  const db = supabase();

  // 1. Fetch source journey
  const { data: sourceJourney, error: jErr } = await db
    .from('journeys')
    .select('*')
    .eq('id', sourceId)
    .is('deleted_at', null)
    .single();

  if (jErr || !sourceJourney) {
    throw new Error(`Source journey not found: ${jErr?.message || 'unknown'}`);
  }

  // 2. Fetch source steps
  const { data: sourceSteps, error: sErr } = await db
    .from('journey_steps')
    .select('*')
    .eq('journey_id', sourceId)
    .is('deleted_at', null);

  if (sErr) {
    throw new Error(`Source steps not found: ${sErr.message}`);
  }

  const newJourneyId = crypto.randomUUID();

  // 3. Insert new journey
  const { data: newJourney, error: njErr } = await db
    .from('journeys')
    .insert({
      id: newJourneyId,
      tenant_id: tenantId,
      title: title || `${sourceJourney.title} (Copy)`,
      description: sourceJourney.description,
      estimated_minutes: sourceJourney.estimated_minutes,
      version: 1,
      status: 'draft',
      is_template: false,
    })
    .select('*')
    .single();

  if (njErr || !newJourney) {
    throw new Error(`Clone journey failed: ${njErr?.message || 'unknown'}`);
  }

  // 4. Insert new steps
  if (sourceSteps && sourceSteps.length > 0) {
    const newSteps = (sourceSteps as JourneyStepRow[]).map((s) => ({
      id: crypto.randomUUID(),
      journey_id: newJourneyId,
      tenant_id: tenantId,
      step_index: s.step_index,
      mode: s.mode,
      title: s.title,
      opening_message: s.opening_message,
      min_turns: s.min_turns,
      step_guidance: s.step_guidance,
      scoring_criteria: s.scoring_criteria,
    }));

    const { error: nsErr } = await db.from('journey_steps').insert(newSteps);
    if (nsErr) {
      throw new Error(`Clone steps failed: ${nsErr.message}`);
    }
  }

  return newJourney as JourneyRow;
}
