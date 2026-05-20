create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete set null,
  actor_id    uuid not null,               -- Supabase Auth user id
  actor_email text,
  action      text not null,               -- e.g. 'journey.create', 'step.delete', 'tenant.update'
  resource    text not null,               -- e.g. 'journey', 'step', 'tenant', 'webhook'
  resource_id text,                        -- UUID of the affected record
  metadata    jsonb,                       -- diff or relevant context
  created_at  timestamptz not null default now()
);

create index on audit_log (tenant_id, created_at desc);

alter table audit_log enable row level security;

create policy "admin read" on audit_log for select
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- No insert/update/delete policy — writes go through service role only
