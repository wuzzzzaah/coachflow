-- Schedule config on the journey itself
alter table journeys
  add column schedule_type text check (schedule_type in ('manual', 'daily', 'weekly')) not null default 'manual',
  add column schedule_hour  int  check (schedule_hour between 0 and 23),   -- UTC hour to send
  add column schedule_day   int  check (schedule_day  between 0 and 6);    -- 0=Sun for weekly

-- Track when a step was last delivered to a user
create table scheduled_deliveries (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references users(id)   on delete cascade,
  journey_id  uuid not null references journeys(id) on delete cascade,
  step_index  int  not null,
  delivered_at timestamptz not null default now()
);

create index on scheduled_deliveries (tenant_id, user_id, journey_id);

-- Enable RLS and tenant isolation
alter table scheduled_deliveries enable row level security;

create policy "scheduled_deliveries: tenant isolation" on scheduled_deliveries
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);

create policy "scheduled_deliveries: insert own tenant" on scheduled_deliveries
  for insert with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
