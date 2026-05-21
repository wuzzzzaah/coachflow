-- Web channel messages for polling.
create table if not exists web_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  direction   text not null check (direction in ('inbound', 'outbound')),
  content     jsonb not null,
  created_at  timestamptz default now()
);

-- Enable RLS.
alter table web_messages enable row level security;

-- Tenant isolation policy.
create policy "web_messages: tenant isolation" on web_messages
  using (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Index for polling.
create index if not exists idx_web_messages_user_polling on web_messages(user_id, direction, created_at);
