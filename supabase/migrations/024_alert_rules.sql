create table alert_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  metric text not null check (metric in ('drop_off', 'idle_user', 'low_score')),
  threshold numeric not null check (threshold >= 0),
  channel text not null check (channel in ('slack', 'email')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table alert_rules enable row level security;

create policy "tenant isolation" on alert_rules
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
