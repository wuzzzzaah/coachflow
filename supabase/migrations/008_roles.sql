-- User roles for the admin API.
-- Stored as a custom claim in Supabase Auth (app_metadata.role).
-- Roles: admin | coach | viewer
--
-- Set a user's role via the Supabase service role API or the admin UI:
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--     where email = 'admin@example.com';
--
-- The JWT then contains: { "app_metadata": { "role": "admin", "tenant_id": "..." } }
-- Middleware reads: req.user.app_metadata.role

-- No DDL needed: roles live entirely in Supabase Auth metadata.
-- This migration documents the convention.

comment on table tenants is
  'Each row = one organisation. admin users manage tenants; tenant_id in JWT controls RLS.';
