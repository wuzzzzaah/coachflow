-- Seed migration: maritime-leadership-001 journey.
-- This is the prototype journey converted from TypeScript to DB rows.
-- Replace <SEED_TENANT_ID> with the actual UUID of the first tenant before running,
-- or run this after inserting the seed tenant row.
--
-- Usage:
--   1. Insert a seed tenant:
--      INSERT INTO tenants (id, name) VALUES ('<uuid>', 'Seed Tenant');
--   2. Set the variable: \set seed_tenant_id '<uuid>'
--   3. Run this file.
--
-- For automated seeding, see scripts/seed.ts (created in T12.1).

do $$
declare
  v_tenant_id uuid;
begin
  -- Use the first tenant row as the seed target; skip if none exists.
  select id into v_tenant_id from tenants order by created_at limit 1;
  if v_tenant_id is null then
    raise notice 'No tenants found — skipping maritime journey seed.';
    return;
  end if;

  -- Journey
  insert into journeys (id, tenant_id, title, description, estimated_minutes, version)
  values (
    'maritime-leadership-001',
    v_tenant_id,
    'Leading with Confidence at Sea',
    'A four-step journey covering coaching, roleplay, reflection, and assessment for maritime leadership development.',
    120,
    1
  )
  on conflict (id) do nothing;

  -- Step 1 — Coaching
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance
  ) values (
    'maritime-leadership-001.step1',
    'maritime-leadership-001',
    v_tenant_id,
    0,
    'coaching',
    'Self-Assessment and Goal Setting',
    E'Welcome to *Leading with Confidence at Sea*.\n\nI''m your AI leadership coach and I''m here to help you grow as a leader in the maritime environment.\n\nBefore we dive in, tell me — what''s the biggest leadership challenge you''re facing on board right now?',
    3,
    'Step 1 — surface a specific leadership challenge the user is facing and a clear development goal. Advance only when both are explicit.'
  )
  on conflict (journey_id, step_index) do nothing;

  -- Step 2 — Roleplay
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria
  ) values (
    'maritime-leadership-001.step2',
    'maritime-leadership-001',
    v_tenant_id,
    1,
    'roleplay',
    'Roleplay: Difficult Crew Conversation',
    E'Great. Now let''s put some of that into practice.\n\n*Scenario:* You''re the First Officer. A senior deck rating, Marcos, has been dismissive of a newer crew member in front of the team twice this week. You need to address it directly.\n\nI''ll play Marcos. When you''re ready, start the conversation.\n\n_(Type READY to begin, or SKIP to move on)_',
    5,
    'Step 2 — roleplay as Marcos, a defensive senior deck rating. Stay in character. Soften only when the user shows empathy AND assertiveness. Advance after at least 5 user turns and a natural resolution, or if the user types DONE.',
    ARRAY['Communication clarity', 'Empathy shown', 'Assertiveness', 'Resolution focus']
  )
  on conflict (journey_id, step_index) do nothing;

  -- Step 3 — Reflection
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance
  ) values (
    'maritime-leadership-001.step3',
    'maritime-leadership-001',
    v_tenant_id,
    2,
    'reflection',
    'Reflection',
    E'That was a challenging scenario. Let''s take a moment to reflect.\n\nWhat did that conversation reveal to you about your own leadership approach?',
    3,
    'Step 3 — reflection. Ask one reflective question per turn. Validate before probing. Connect to the user''s stated challenge from Step 1. Advance after 3 substantive reflections with at least one specific insight.'
  )
  on conflict (journey_id, step_index) do nothing;

  -- Step 4 — Assessment
  insert into journey_steps (
    id, journey_id, tenant_id, step_index, mode, title,
    opening_message, min_turns, step_guidance, scoring_criteria
  ) values (
    'maritime-leadership-001.step4',
    'maritime-leadership-001',
    v_tenant_id,
    3,
    'assessment',
    'Final Assessment',
    E'You''ve done excellent work today. Let me give you your coaching summary.',
    0,
    'Step 4 — produce a score across Self-Awareness, Communication, Resilience based on the full conversation. Reference specific things the user said. Set shouldAdvance=true and populate the score object.',
    ARRAY['Self-Awareness', 'Communication', 'Resilience']
  )
  on conflict (journey_id, step_index) do nothing;

  raise notice 'Maritime leadership seed applied for tenant %', v_tenant_id;
end;
$$;
