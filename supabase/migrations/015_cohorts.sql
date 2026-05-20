create table cohorts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  journey_id text not null references journeys(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table cohort_members (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);

alter table cohorts enable row level security;
alter table cohort_members enable row level security;

create policy "cohorts: tenant isolation" on cohorts
  using (tenant_id = current_tenant_id());

create policy "cohort_members: tenant isolation" on cohort_members
  using (cohort_id in (select id from cohorts where tenant_id = current_tenant_id()));
