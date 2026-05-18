-- Row-Level Security: every table is isolated by the tenant_id claim in the JWT.
-- The claim is injected by the Supabase Auth custom claims hook (see T7.2).
--
-- For service-role API calls (server-side), RLS is bypassed automatically.
-- For anon/user JWTs, only rows belonging to auth.jwt()->>'tenant_id' are visible.

-- Enable RLS on all tenant-scoped tables.
alter table users         enable row level security;
alter table user_journeys enable row level security;
alter table sessions      enable row level security;
alter table messages      enable row level security;
alter table scores        enable row level security;
alter table progression   enable row level security;

-- Helper function: extract tenant_id from the JWT claim.
create or replace function current_tenant_id() returns uuid language sql stable as $$
  select (auth.jwt() ->> 'tenant_id')::uuid
$$;

-- ── users ────────────────────────────────────────────────────────────────────
create policy "users: tenant isolation" on users
  using (tenant_id = current_tenant_id());

create policy "users: insert own tenant" on users
  for insert with check (tenant_id = current_tenant_id());

-- ── user_journeys ─────────────────────────────────────────────────────────────
create policy "user_journeys: tenant isolation" on user_journeys
  using (tenant_id = current_tenant_id());

create policy "user_journeys: insert own tenant" on user_journeys
  for insert with check (tenant_id = current_tenant_id());

-- ── sessions ─────────────────────────────────────────────────────────────────
create policy "sessions: tenant isolation" on sessions
  using (tenant_id = current_tenant_id());

create policy "sessions: insert own tenant" on sessions
  for insert with check (tenant_id = current_tenant_id());

-- ── messages ─────────────────────────────────────────────────────────────────
create policy "messages: tenant isolation" on messages
  using (tenant_id = current_tenant_id());

create policy "messages: insert own tenant" on messages
  for insert with check (tenant_id = current_tenant_id());

-- ── scores ───────────────────────────────────────────────────────────────────
create policy "scores: tenant isolation" on scores
  using (tenant_id = current_tenant_id());

create policy "scores: insert own tenant" on scores
  for insert with check (tenant_id = current_tenant_id());

-- ── progression ──────────────────────────────────────────────────────────────
create policy "progression: tenant isolation" on progression
  using (tenant_id = current_tenant_id());

create policy "progression: insert own tenant" on progression
  for insert with check (tenant_id = current_tenant_id());
