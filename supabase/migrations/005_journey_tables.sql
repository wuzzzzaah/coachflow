-- Journey content in the database.
-- Replaces the TypeScript journey files so new journeys can be authored without code changes.

create table if not exists journeys (
  id                 text primary key,          -- e.g. "maritime-leadership-001"
  tenant_id          uuid not null references tenants(id) on delete cascade,
  title              text not null,
  description        text not null default '',
  estimated_minutes  integer not null default 30,
  version            integer not null default 1,
  created_at         timestamptz default now()
);

create table if not exists journey_steps (
  id                 text not null,             -- e.g. "maritime-leadership-001-step-1"
  journey_id         text not null references journeys(id) on delete cascade,
  tenant_id          uuid not null references tenants(id) on delete cascade,
  step_index         integer not null,
  mode               text not null check (mode in ('coaching','roleplay','reflection','assessment')),
  title              text not null,
  opening_message    text not null,
  min_turns          integer not null default 0,
  step_guidance      text not null default '',
  scoring_criteria   text[],
  primary key (journey_id, step_index)
);

create table if not exists journey_prompts (
  id                 uuid primary key default gen_random_uuid(),
  journey_id         text not null references journeys(id) on delete cascade,
  tenant_id          uuid not null references tenants(id) on delete cascade,
  prompt_key         text not null,             -- "coaching" | "roleplay" | "reflection" | "scoring"
  content            text not null,
  unique (journey_id, tenant_id, prompt_key)
);

-- Enable RLS.
alter table journeys        enable row level security;
alter table journey_steps   enable row level security;
alter table journey_prompts enable row level security;

create policy "journeys: tenant isolation" on journeys
  using (tenant_id = current_tenant_id());

create policy "journey_steps: tenant isolation" on journey_steps
  using (tenant_id = current_tenant_id());

create policy "journey_prompts: tenant isolation" on journey_prompts
  using (tenant_id = current_tenant_id());

-- Lookup indexes.
create index if not exists idx_journeys_tenant        on journeys(tenant_id);
create index if not exists idx_journey_steps_journey  on journey_steps(journey_id);
create index if not exists idx_journey_steps_tenant   on journey_steps(tenant_id);
