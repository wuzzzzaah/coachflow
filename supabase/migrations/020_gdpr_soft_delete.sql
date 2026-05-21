-- Add deleted_at timestamptz to users and user_journeys for GDPR compliance
alter table users add column if not exists deleted_at timestamptz;
alter table user_journeys add column if not exists deleted_at timestamptz;
