create table tenant_webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  url text not null,
  secret text not null,           -- HMAC-SHA256 signing secret
  events text[] not null,         -- e.g. '{step_completed,journey_completed}'
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table tenant_webhooks enable row level security;

create policy "tenant isolation" on tenant_webhooks
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
