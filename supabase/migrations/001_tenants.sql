-- Tenants: one record per organisation using the platform.
create table if not exists tenants (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  created_at           timestamptz default now()
);
