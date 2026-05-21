import { supabase } from './supabaseClient';
import { CoachingMode } from '@coachflow/shared';

export async function createStep(
  tenantId: string,
  journeyId: string,
  stepData: {
    id: string;
    step_index: number;
    mode: CoachingMode;
    title: string;
    opening_message: string;
    min_turns?: number;
    step_guidance?: string;
    scoring_criteria?: string[] | null;
    media_url?: string | null;
    media_type?: 'image' | 'document' | 'audio' | 'video' | null;
  }
): Promise<void> {
  const db = supabase();
  const { error } = await db.from('journey_steps').insert({
    id: stepData.id,
    journey_id: journeyId,
    tenant_id: tenantId,
    step_index: stepData.step_index,
    mode: stepData.mode,
    title: stepData.title,
    opening_message: stepData.opening_message,
    min_turns: stepData.min_turns ?? 0,
    step_guidance: stepData.step_guidance ?? '',
    scoring_criteria: stepData.scoring_criteria ?? null,
    media_url: stepData.media_url ?? null,
    media_type: stepData.media_type ?? null,
  });

  if (error) throw new Error(`Create step failed: ${error.message}`);
}

export async function updateStep(
  tenantId: string,
  journeyId: string,
  stepId: string,
  stepData: {
    mode?: CoachingMode;
    title?: string;
    opening_message?: string;
    min_turns?: number;
    step_guidance?: string;
    scoring_criteria?: string[] | null;
    media_url?: string | null;
    media_type?: 'image' | 'document' | 'audio' | 'video' | null;
  }
): Promise<void> {
  const db = supabase();
  const updates: Record<string, unknown> = {};
  if (stepData.mode !== undefined) updates.mode = stepData.mode;
  if (stepData.title !== undefined) updates.title = stepData.title;
  if (stepData.opening_message !== undefined) updates.opening_message = stepData.opening_message;
  if (stepData.min_turns !== undefined) updates.min_turns = stepData.min_turns;
  if (stepData.step_guidance !== undefined) updates.step_guidance = stepData.step_guidance;
  if (stepData.scoring_criteria !== undefined) updates.scoring_criteria = stepData.scoring_criteria;
  if (stepData.media_url !== undefined) updates.media_url = stepData.media_url;
  if (stepData.media_type !== undefined) updates.media_type = stepData.media_type;

  if (Object.keys(updates).length === 0) return;

  const { error } = await db
    .from('journey_steps')
    .update(updates)
    .eq('id', stepId)
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (error) throw new Error(`Update step failed: ${error.message}`);
}

export async function deleteStep(tenantId: string, journeyId: string, stepId: string): Promise<void> {
  const db = supabase();
  const { error } = await db
    .from('journey_steps')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', stepId)
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (error) throw new Error(`Delete step failed: ${error.message}`);
}

export async function reorderSteps(tenantId: string, journeyId: string, stepIds: string[]): Promise<void> {
  const db = supabase();

  // To avoid unique constraint violations on (journey_id, step_index) during updates,
  // we first offset all step indices by a large number, then update them to their final values.

  const offset = 10000;

  for (let i = 0; i < stepIds.length; i++) {
    const id = stepIds[i];
    // 1. Assign a temporary out-of-bounds step_index unique to this step
    const { error: err1 } = await db
      .from('journey_steps')
      .update({ step_index: offset + i })
      .eq('id', id)
      .eq('journey_id', journeyId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (err1) throw new Error(`Reorder step failed (temp update): ${err1.message}`);
  }

  for (let i = 0; i < stepIds.length; i++) {
    // 2. Assign the actual step_index
    const { error: err2 } = await db
      .from('journey_steps')
      .update({ step_index: i })
      .eq('id', stepIds[i])
      .eq('journey_id', journeyId)
      .eq('tenant_id', tenantId)
      .eq('step_index', offset + i)
      .is('deleted_at', null);

    if (err2) throw new Error(`Reorder step failed (final update): ${err2.message}`);
  }
}
