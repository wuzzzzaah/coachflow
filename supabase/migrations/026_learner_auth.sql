-- Add learner_id to the users table to link to Supabase Auth users.
-- This allows learners to log in via magic links.

ALTER TABLE users ADD COLUMN IF NOT EXISTS learner_id uuid REFERENCES auth.users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;

-- A learner can belong to multiple tenants, so learner_id + tenant_id should be unique.
-- We also add a unique constraint on email + tenant_id to facilitate linking.
ALTER TABLE users ADD CONSTRAINT users_learner_id_tenant_id_key UNIQUE (learner_id, tenant_id);
ALTER TABLE users ADD CONSTRAINT users_email_tenant_id_key UNIQUE (email, tenant_id);

-- Index for looking up users.
CREATE INDEX IF NOT EXISTS idx_users_learner_id ON users(learner_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
