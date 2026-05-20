import { supabase } from './supabaseClient';
import { AIScore } from '@coachflow/shared';

/** Persist the evaluation result of an assessment step. */
export async function saveScore(params: {
  userId: string;
  sessionId: string;
  journeyId: string;
  stepId: string;
  score: AIScore;
}): Promise<void> {
  const db = supabase();
  const { error } = await db.from('scores').insert({
    user_id: params.userId,
    session_id: params.sessionId,
    journey_id: params.journeyId,
    step_id: params.stepId,
    score: params.score.overall,
    max_score: 10,
    criteria: params.score.dimensions,
    feedback: `${params.score.summary}\n\nDevelopment focus: ${params.score.developmentFocus}`,
  });
  if (error) throw new Error(`Save score failed: ${error.message}`);
}

/** Retrieve all scores for a given user, newest first. */
export async function getScoresForUser(userId: string, journeyId?: string) {
  const db = supabase();
  let query = db
    .from('scores')
    .select('*')
    .eq('user_id', userId);

  if (journeyId) {
    query = query.eq('journey_id', journeyId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`Get scores failed: ${error.message}`);
  return data ?? [];
}
