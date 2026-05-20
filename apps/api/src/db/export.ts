import { supabase } from './supabaseClient';

export async function getUsersExportData(tenantId: string) {
  const db = supabase();

  const [
    { data: users, error: uErr },
    { data: userJourneys, error: ujErr },
    { data: journeys, error: jErr },
    { data: steps, error: stErr },
    { data: scores, error: scErr },
    { data: sessions, error: sessErr }
  ] = await Promise.all([
    db.from('users').select('id, whatsapp_number').eq('tenant_id', tenantId),
    db.from('user_journeys').select('user_id, journey_id').eq('tenant_id', tenantId),
    db.from('journeys').select('id, title').eq('tenant_id', tenantId).is('deleted_at', null),
    db.from('journey_steps').select('journey_id, id').eq('tenant_id', tenantId).is('deleted_at', null),
    db.from('scores').select('user_id, journey_id, score').eq('tenant_id', tenantId),
    db.from('sessions').select('user_id, journey_id, step_id, started_at, ended_at').eq('tenant_id', tenantId),
  ]);

  if (uErr || ujErr || jErr || stErr || scErr || sessErr) {
    throw new Error('Failed to fetch export data from one or more tables');
  }

  if (!users || !userJourneys || !journeys) {
    return [];
  }

  const result = userJourneys.map(uj => {
    const user = users.find(u => u.id === uj.user_id);
    const journey = journeys.find(j => j.id === uj.journey_id);
    if (!user || !journey) return null;

    const journeySteps = (steps || []).filter(s => s.journey_id === uj.journey_id);
    const userJourneySessions = (sessions || []).filter(s => s.user_id === uj.user_id && s.journey_id === uj.journey_id);
    const completedStepIds = new Set(userJourneySessions.filter(s => s.ended_at).map(s => s.step_id));

    const userJourneyScores = (scores || []).filter(s => s.user_id === uj.user_id && s.journey_id === uj.journey_id);
    const avgScore = userJourneyScores.length > 0
      ? Number((userJourneyScores.reduce((acc, s) => acc + Number(s.score), 0) / userJourneyScores.length).toFixed(2))
      : 0;

    const lastActive = userJourneySessions.length > 0
      ? new Date(Math.max(...userJourneySessions.map(s => new Date(s.ended_at || s.started_at).getTime()))).toISOString()
      : null;

    return {
      user_id: user.id,
      phone: user.whatsapp_number,
      journey_title: journey.title,
      completed_steps: completedStepIds.size,
      total_steps: journeySteps.length,
      last_active_at: lastActive,
      avg_score: avgScore
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return result;
}

export async function getUserExportData(userId: string, tenantId: string) {
  const db = supabase();

  const { data: scores, error: scoresError } = await db
    .from('scores')
    .select('created_at, session_id, journey_id, step_id, score, max_score, feedback')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (scoresError) throw new Error(`Get scores failed: ${scoresError.message}`);
  if (!scores || scores.length === 0) return [];

  const journeyIds = Array.from(new Set(scores.map(s => s.journey_id).filter((id): id is string => !!id)));
  const { data: journeys } = await db.from('journeys').select('id, title').in('id', journeyIds);
  const { data: steps } = await db.from('journey_steps').select('id, title').in('journey_id', journeyIds);

  return scores.map(s => {
    const journey = journeys?.find(j => j.id === s.journey_id);
    const step = steps?.find(st => st.id === s.step_id);
    return {
      date: s.created_at,
      session_id: s.session_id,
      journey_title: journey?.title || s.journey_id || '',
      step_title: step?.title || s.step_id || '',
      score: s.score,
      max_score: s.max_score,
      feedback: s.feedback
    };
  });
}
