-- ──────────────────────────────────────────────────────────────────────────────
-- CoachFlow Demo Setup
-- Run this once in Supabase SQL Editor after all migrations have been applied.
-- It creates a demo tenant, seeds the showcase journey, and returns the tenant ID.
-- ──────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_tenant_id      uuid := 'a0000000-de40-0000-0000-000000000001';
  v_journey_id     text := 'leadership-presence-001';
  -- ↓ Paste your Meta phone_number_id here (from Meta Developer Portal → WhatsApp → API Setup).
  -- Leave as null to rely on the DEFAULT_TENANT_ID env-var fallback in the API.
  v_phone_number_id text := null; -- e.g. '1110633348800409'
begin

  -- ── 1. Tenant ──────────────────────────────────────────────────────────────
  insert into tenants (id, name, phone_number_id)
  values (v_tenant_id, 'CoachFlow Demo', v_phone_number_id)
  on conflict (id) do update set
    name = excluded.name,
    phone_number_id = coalesce(excluded.phone_number_id, tenants.phone_number_id);

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

  -- ════════════════════════════════════════════════════════════════════════════
  -- Journey 2 — Difficult Conversations
  -- ════════════════════════════════════════════════════════════════════════════

  insert into journeys (
    id, tenant_id, title, description,
    estimated_minutes, status, is_template,
    version_number, schedule_type
  ) values (
    'difficult-conversations-001',
    v_tenant_id,
    'Difficult Conversations',
    'A 4-step journey for anyone who has been putting off a hard conversation. Identify the talk you''ve been avoiding, practise it in a safe roleplay, reflect on what held you back, and leave with a concrete action plan.',
    20,
    'published',
    false,
    1,
    'manual'
  )
  on conflict (id) do update set
    status = 'published',
    title  = excluded.title;

  -- Step 1 — Coaching: What conversation are you avoiding?
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'difficult-conversations-001.step1',
    'difficult-conversations-001', v_tenant_id,
    0, 'coaching',
    'The Conversation You''ve Been Avoiding',
    E'Welcome to *Difficult Conversations*.\n\nMost of us have at least one conversation we keep delaying. This 20-minute session will help you prepare, practise, and commit to having it.\n\n*Think of a specific conversation you''ve been putting off. Who is it with, and what do you need to say?*',
    3,
    'Coaching step. Help the user name the specific conversation they have been avoiding — who it is with, what the core message is, and why they have been delaying it. Push for specifics: avoid vague answers like "I need to be more direct". Get the person, the message, and the fear named clearly before advancing.',
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message = excluded.opening_message,
    step_guidance   = excluded.step_guidance;

  -- Step 2 — Roleplay: Practice the conversation
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'difficult-conversations-001.step2',
    'difficult-conversations-001', v_tenant_id,
    1, 'roleplay',
    'Roleplay: Say It Now',
    E'Let''s practise.\n\nI''ll play the person you need to speak with. Based on what you''ve shared, I''ll respond as realistically as I can — which might mean some pushback or defensiveness.\n\nYou start the conversation whenever you''re ready. Go.\n\n_Type *DONE* when you want to wrap up._',
    5,
    'You are the person the user needs to have a difficult conversation with. Adapt your character based on the context they described in Step 1 — use the name and relationship they mentioned. Be realistic: react defensively or emotionally if the user is vague or accusatory, but become more receptive when they are specific, calm, and show genuine care. Do NOT make it artificially easy. Advance naturally after at least 5 user turns or when the user types DONE.',
    ARRAY['Directness & clarity', 'Emotional regulation', 'Empathy & care', 'Staying on message'],
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message  = excluded.opening_message,
    step_guidance    = excluded.step_guidance,
    scoring_criteria = excluded.scoring_criteria;

  -- Step 3 — Reflection: What held you back?
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'difficult-conversations-001.step3',
    'difficult-conversations-001', v_tenant_id,
    2, 'reflection',
    'What Was Holding You Back?',
    E'Well done. That takes real courage.\n\nNow let''s understand the pattern.\n\n*What was the fear or belief that made you avoid this conversation in the first place?*',
    3,
    'Reflection step. Help the user name the underlying fear or belief — not just "I was scared" but the specific story they were telling themselves (e.g. "They''ll think I''m difficult", "I might lose the relationship", "I don''t have the right"). Ask one focused question per turn. Advance after at least 3 turns where the user articulates a genuine insight about their avoidance pattern.',
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message = excluded.opening_message,
    step_guidance   = excluded.step_guidance;

  -- Step 4 — Assessment: Scorecard + action plan
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'difficult-conversations-001.step4',
    'difficult-conversations-001', v_tenant_id,
    3, 'assessment',
    'Your Conversation Readiness Score',
    E'You''ve done the hard work. Here''s your personalised readiness scorecard — and a 3-step action plan for the real conversation.',
    0,
    'Assessment step. Score the user across Directness, Empathy, and Emotional Regulation. Reference specific phrases they used in the roleplay. After the scores, output a clear 3-step action plan: (1) what to say in the opening sentence of the real conversation, (2) the one thing to watch out for, (3) when to have it. Be specific and encouraging. Set shouldAdvance=true.',
    ARRAY['Directness', 'Empathy', 'Emotional Regulation'],
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message  = excluded.opening_message,
    step_guidance    = excluded.step_guidance,
    scoring_criteria = excluded.scoring_criteria;

  -- ════════════════════════════════════════════════════════════════════════════
  -- Journey 3 — Managing Up
  -- ════════════════════════════════════════════════════════════════════════════

  insert into journeys (
    id, tenant_id, title, description,
    estimated_minutes, status, is_template,
    version_number, schedule_type
  ) values (
    'managing-up-001',
    v_tenant_id,
    'Managing Up',
    'A 3-step journey for anyone who needs to influence, align, or push back with senior stakeholders. Map what your manager really cares about, practise delivering a high-stakes update, and walk away with a concrete stakeholder strategy.',
    20,
    'published',
    false,
    1,
    'manual'
  )
  on conflict (id) do update set
    status = 'published',
    title  = excluded.title;

  -- Step 1 — Coaching: Map the stakeholder
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'managing-up-001.step1',
    'managing-up-001', v_tenant_id,
    0, 'coaching',
    'Know Your Stakeholder',
    E'Welcome to *Managing Up*.\n\nInfluencing upward is one of the most underrated leadership skills. In the next 20 minutes, you''ll map your stakeholder, practise a high-stakes conversation, and leave with a clear strategy.\n\n*Who is the senior stakeholder you most need to influence right now — and what outcome do you need from them?*',
    3,
    'Coaching step. Help the user build a clear picture of the specific senior stakeholder they need to influence: who they are, what they care about most (metrics, relationships, risk, speed?), what the user needs from them, and what the likely obstacle is. Push past vague answers — get to specifics before advancing.',
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message = excluded.opening_message,
    step_guidance   = excluded.step_guidance;

  -- Step 2 — Roleplay: Deliver the high-stakes update
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'managing-up-001.step2',
    'managing-up-001', v_tenant_id,
    1, 'roleplay',
    'Roleplay: The High-Stakes Update',
    E'Time to practise.\n\n*Scenario:* You have 5 minutes with your senior stakeholder. They''re busy, slightly impatient, and scan for red flags fast. You need to land your key message and get what you need.\n\nI''ll play your stakeholder. You start.\n\n_Type *DONE* when you''re finished._',
    4,
    'You are the senior stakeholder the user described in Step 1. Use the name and context from their coaching conversation. Be realistically senior: you''re time-pressured, you cut to the bottom line, you ask "so what does that mean for us?" and "what do you need from me?". Be receptive when the user is concise, confident, and frames things in terms of what YOU care about. Lose patience with rambling or unclear asks. Advance after at least 4 user turns or when the user types DONE.',
    ARRAY['Executive communication', 'Stakeholder awareness', 'Confidence & clarity', 'Getting to the ask'],
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message  = excluded.opening_message,
    step_guidance    = excluded.step_guidance,
    scoring_criteria = excluded.scoring_criteria;

  -- Step 3 — Assessment: Stakeholder strategy scorecard
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria,
    branch_on_low_score, branch_score_threshold, branch_step_index,
    media_url, media_type
  ) values (
    'managing-up-001.step3',
    'managing-up-001', v_tenant_id,
    2, 'assessment',
    'Your Managing-Up Scorecard',
    E'Here''s your personalised Managing Up scorecard — plus a clear stakeholder strategy to take into your next real interaction.',
    0,
    'Assessment step. Score the user across Executive Communication, Stakeholder Awareness, and Confidence. Reference specific moments from the roleplay (what they said well, what landed flat). Then output a 3-point stakeholder strategy: (1) the one thing this stakeholder cares about most and how to lead with it, (2) the communication style adjustment that will build trust fastest, (3) the specific next action to take this week. Set shouldAdvance=true.',
    ARRAY['Executive Communication', 'Stakeholder Awareness', 'Confidence'],
    false, null, null, null, null
  )
  on conflict (journey_id, step_index) do update set
    opening_message  = excluded.opening_message,
    step_guidance    = excluded.step_guidance,
    scoring_criteria = excluded.scoring_criteria;

  -- ── Summary notices ────────────────────────────────────────────────────────
  raise notice '';
  raise notice '✅ Demo setup complete!';
  raise notice '   Tenant ID : %', v_tenant_id;
  raise notice '   Journeys  :';
  raise notice '     1. Leading with Presence      (%)', v_journey_id;
  raise notice '     2. Difficult Conversations    (difficult-conversations-001)';
  raise notice '     3. Managing Up                (managing-up-001)';
  raise notice '';
  raise notice '👉 Copy these values into apps/api/.env:';
  raise notice '   DEFAULT_TENANT_ID=%', v_tenant_id;
  raise notice '';
  raise notice '📱 WhatsApp setup:';
  raise notice '   1. Run: ngrok http 3001';
  raise notice '   2. In Meta Developer Portal → WhatsApp → Configuration:';
  raise notice '      Webhook URL: https://<ngrok-url>/webhook/whatsapp';
  raise notice '      Verify Token: <your WHATSAPP_WEBHOOK_VERIFY_TOKEN>';
  raise notice '   3. Subscribe to: messages';
  if v_phone_number_id is not null then
    raise notice '   ✅ phone_number_id % set on tenant', v_phone_number_id;
  else
    raise notice '   ℹ️  phone_number_id not set — API will fall back to WHATSAPP_PHONE_NUMBER_ID env var';
    raise notice '      Or re-run this seed with v_phone_number_id set to your phone_number_id';
  end if;

end;
$$;
