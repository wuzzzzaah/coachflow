-- ──────────────────────────────────────────────────────────────────────────────
-- CoachFlow Demo Setup
-- Run this once in Supabase SQL Editor after all migrations have been applied.
-- It creates a demo tenant, seeds the showcase journey, and returns the tenant ID.
-- ──────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_tenant_id uuid := 'a0000000-demo-0000-0000-000000000001';
  v_journey_id text := 'leadership-presence-001';
begin

  -- ── 1. Tenant ──────────────────────────────────────────────────────────────
  insert into tenants (id, name)
  values (v_tenant_id, 'CoachFlow Demo')
  on conflict (id) do update set name = excluded.name;

  -- ── 2. Journey ─────────────────────────────────────────────────────────────
  insert into journeys (
    id, tenant_id, title, description,
    estimated_minutes, status, is_template,
    version_number, schedule_type
  ) values (
    v_journey_id,
    v_tenant_id,
    'Leading with Presence',
    'A 4-step AI coaching journey that builds self-awareness, practises a tough conversation, deepens reflection, and scores your leadership presence — all in under 30 minutes.',
    25,
    'published',
    false,
    1,
    'manual'
  )
  on conflict (id) do update set
    status = 'published',
    title  = excluded.title;

  -- ── Step 1 — Coaching: Surface the challenge ───────────────────────────────
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    v_journey_id || '.step1',
    v_journey_id, v_tenant_id,
    0, 'coaching',
    'Your Leadership Challenge',
    E'Welcome to *Leading with Presence*.\n\nI''m your AI coach. This session will take about 25 minutes and covers four stages: a real conversation, a roleplay, reflection, and a scored summary.\n\nLet''s start with what''s on your mind.\n\n*What''s the toughest leadership challenge you''re navigating right now?*',
    3,
    'Coaching step. Help the user articulate ONE specific leadership challenge and a concrete goal. Ask follow-up questions to get specifics — avoid generic answers. Advance only when the challenge and goal are both clearly named.',
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message = excluded.opening_message,
    step_guidance   = excluded.step_guidance;

  -- ── Step 2 — Roleplay: Difficult conversation ──────────────────────────────
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    v_journey_id || '.step2',
    v_journey_id, v_tenant_id,
    1, 'roleplay',
    'Roleplay: The Hard Conversation',
    E'Good. Now let''s practise.\n\n*Scenario:* You''re a team lead. A high-performer on your team — Jordan — has been visibly checked out the last two weeks: missing stand-ups, delivering below standard, and short with teammates. You need to have a direct but empathetic conversation.\n\nI''ll play Jordan. You start whenever you''re ready.\n\n_Type *DONE* to end the roleplay early._',
    5,
    'You are Jordan — defensive at first, but willing to open up when the user shows genuine empathy and creates psychological safety. Stay in character throughout. Soften gradually as the user demonstrates listening and problem-solving. Advance naturally after at least 5 user turns or when the user types DONE.',
    ARRAY['Empathy & psychological safety', 'Clarity of message', 'Listening & curiosity', 'Problem-solving orientation'],
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message  = excluded.opening_message,
    step_guidance    = excluded.step_guidance,
    scoring_criteria = excluded.scoring_criteria;

  -- ── Step 3 — Reflection ────────────────────────────────────────────────────
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    v_journey_id || '.step3',
    v_journey_id, v_tenant_id,
    2, 'reflection',
    'Reflection',
    E'That took courage. Let''s slow down and make sense of what just happened.\n\n*What did that conversation reveal about the kind of leader you want to be?*',
    3,
    'Reflection step. Ask one focused question per turn. Connect what the user shares back to the specific challenge they named in Step 1. Validate before probing deeper. Advance after at least 3 substantive exchanges where the user surfaces a genuine insight.',
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message = excluded.opening_message,
    step_guidance   = excluded.step_guidance;

  -- ── Step 4 — Assessment ────────────────────────────────────────────────────
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    v_journey_id || '.step4',
    v_journey_id, v_tenant_id,
    3, 'assessment',
    'Your Leadership Scorecard',
    E'You''ve completed the journey. Let me put together your personalised scorecard.',
    0,
    'Assessment step. Produce a detailed, personalised score across Self-Awareness, Communication, Resilience. Reference specific things the user said in earlier steps by name. Be specific and encouraging. Set shouldAdvance=true and populate the full score object.',
    ARRAY['Self-Awareness', 'Communication', 'Resilience'],
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message  = excluded.opening_message,
    step_guidance    = excluded.step_guidance,
    scoring_criteria = excluded.scoring_criteria;

  raise notice '';
  raise notice '✅ Demo setup complete!';
  raise notice '   Tenant ID : %', v_tenant_id;
  raise notice '   Journey   : Leading with Presence (%)', v_journey_id;
  raise notice '';
  raise notice '👉 Copy this tenant ID into your .env files as DEFAULT_TENANT_ID';
  raise notice '   DEFAULT_TENANT_ID=%', v_tenant_id;

end;
$$;
