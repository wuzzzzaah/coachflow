-- Add tenant_id to every table that needs row-level isolation.
-- NULL allowed during migration; set NOT NULL after back-filling the seed tenant.

alter table users          add column if not exists tenant_id uuid references tenants(id);
alter table user_journeys  add column if not exists tenant_id uuid references tenants(id);
alter table sessions       add column if not exists tenant_id uuid references tenants(id);
alter table messages       add column if not exists tenant_id uuid references tenants(id);
alter table scores         add column if not exists tenant_id uuid references tenants(id);
alter table progression    add column if not exists tenant_id uuid references tenants(id);

-- Indexes for tenant-scoped queries.
create index if not exists idx_users_tenant           on users(tenant_id);
create index if not exists idx_user_journeys_tenant   on user_journeys(tenant_id);
create index if not exists idx_sessions_tenant        on sessions(tenant_id);
create index if not exists idx_messages_tenant        on messages(tenant_id);
create index if not exists idx_scores_tenant          on scores(tenant_id);
create index if not exists idx_progression_tenant     on progression(tenant_id);
