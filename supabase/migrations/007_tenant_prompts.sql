-- Per-tenant prompt overrides. Operators can customise the system prompt and
-- per-mode guidance without touching code. Falls back to defaults when absent.
--
-- prompt_key values: "system" | "coaching" | "roleplay" | "reflection" | "scoring"

create table if not exists tenant_prompts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  prompt_key  text not null,
  content     text not null,
  updated_at  timestamptz default now(),
  unique (tenant_id, prompt_key)
);

alter table tenant_prompts enable row level security;

create policy "tenant_prompts: tenant isolation" on tenant_prompts
  using (tenant_id = current_tenant_id());

create policy "tenant_prompts: insert own tenant" on tenant_prompts
  for insert with check (tenant_id = current_tenant_id());

create policy "tenant_prompts: update own tenant" on tenant_prompts
  for update using (tenant_id = current_tenant_id());

create index if not exists idx_tenant_prompts_tenant on tenant_prompts(tenant_id);
