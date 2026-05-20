-- Reminder Log: tracks proactive re-engagement messages sent to users.
create table if not exists reminder_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  reminder_type text not null default 'nudge'
);

create index if not exists idx_reminder_log_user_sent on reminder_log(user_id, sent_at desc);
create index if not exists idx_reminder_log_tenant on reminder_log(tenant_id);

-- Enable RLS and tenant isolation.
alter table reminder_log enable row level security;

create policy "reminder_log: tenant isolation" on reminder_log
  using (tenant_id = current_tenant_id());

create policy "reminder_log: insert own tenant" on reminder_log
  for insert with check (tenant_id = current_tenant_id());
