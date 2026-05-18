import { supabase } from './supabaseClient';
import { JourneyConfig, JourneyStep, JourneyRow, JourneyStepRow } from '@coachflow/shared';

function rowToStep(row: JourneyStepRow): JourneyStep {
  return {
    id: row.id,
    index: row.step_index,
    mode: row.mode,
    title: row.title,
    openingMessage: row.opening_message,
    minTurns: row.min_turns,
    stepGuidance: row.step_guidance,
    scoringCriteria: row.scoring_criteria ?? undefined,
  };
}

function rowsToConfig(journey: JourneyRow, steps: JourneyStepRow[]): JourneyConfig {
  const sorted = [...steps].sort((a, b) => a.step_index - b.step_index);
  return {
    id: journey.id,
    title: journey.title,
    description: journey.description,
    totalSteps: sorted.length,
    estimatedDuration: `${journey.estimated_minutes} minutes`,
    steps: sorted.map(rowToStep),
  };
}

export async function listJourneys(tenantId: string): Promise<JourneyConfig[]> {
  const db = supabase();
  const { data: journeyRows, error: jErr } = await db
    .from('journeys')
    .select('*')
    .eq('tenant_id', tenantId);
  if (jErr) throw new Error(`List journeys failed: ${jErr.message}`);
  if (!journeyRows || journeyRows.length === 0) return [];

  const journeyIds = (journeyRows as JourneyRow[]).map((j) => j.id);
  const { data: stepRows, error: sErr } = await db
    .from('journey_steps')
    .select('*')
    .in('journey_id', journeyIds)
    .eq('tenant_id', tenantId);
  if (sErr) throw new Error(`List journey steps failed: ${sErr.message}`);

  const stepsByJourney = new Map<string, JourneyStepRow[]>();
  for (const step of (stepRows ?? []) as JourneyStepRow[]) {
    const arr = stepsByJourney.get(step.journey_id) ?? [];
    arr.push(step);
    stepsByJourney.set(step.journey_id, arr);
  }

  return (journeyRows as JourneyRow[]).map((j) => rowsToConfig(j, stepsByJourney.get(j.id) ?? []));
}

export async function getJourney(
  tenantId: string,
  journeyId: string,
): Promise<JourneyConfig | null> {
  const db = supabase();
  const { data: journey, error: jErr } = await db
    .from('journeys')
    .select('*')
    .eq('id', journeyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (jErr) throw new Error(`Get journey failed: ${jErr.message}`);
  if (!journey) return null;

  const { data: steps, error: sErr } = await db
    .from('journey_steps')
    .select('*')
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId);
  if (sErr) throw new Error(`Get journey steps failed: ${sErr.message}`);

  return rowsToConfig(journey as JourneyRow, (steps ?? []) as JourneyStepRow[]);
}

export async function getStep(
  tenantId: string,
  journeyId: string,
  stepIndex: number,
): Promise<JourneyStep | null> {
  const db = supabase();
  const { data, error } = await db
    .from('journey_steps')
    .select('*')
    .eq('journey_id', journeyId)
    .eq('tenant_id', tenantId)
    .eq('step_index', stepIndex)
    .maybeSingle();
  if (error) throw new Error(`Get step failed: ${error.message}`);
  if (!data) return null;
  return rowToStep(data as JourneyStepRow);
}
