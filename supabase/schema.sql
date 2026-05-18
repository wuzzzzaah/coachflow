-- AI Coaching Platform — Supabase Schema
-- Run this in the Supabase SQL editor or via `supabase db push` after placing it
-- in your migrations directory.

-- Users: one record per WhatsApp number
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  whatsapp_number text not null unique,  -- e.g. "639171234567"
  display_name text,
  current_journey_id text,
  current_step_index integer default 0,
  onboarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User journeys: tracks each user's journey enrollment and progress
create table if not exists user_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  journey_id text not null,
  status text default 'active',           -- active, completed, paused
  started_at timestamptz default now(),
  completed_at timestamptz,
  current_step_index integer default 0,
  metadata jsonb default '{}'
);

-- Sessions: individual conversation sessions per step
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  journey_id text,
  step_id text,
  mode text,                              -- coaching, roleplay, reflection, assessment
  started_at timestamptz default now(),
  ended_at timestamptz,
  message_count integer default 0,
  summary text
);

-- Messages: full conversation log
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  whatsapp_message_id text,              -- Meta's message ID for deduplication
  role text not null,                    -- user, assistant
  content text not null,
  created_at timestamptz default now()
);

-- Scores: evaluation results per step
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  journey_id text,
  step_id text,
  score numeric(4,2),                    -- 0.00 to 10.00
  max_score numeric(4,2) default 10,
  criteria jsonb,                        -- JSON breakdown per scoring dimension
  feedback text,
  created_at timestamptz default now()
);

-- Progression: milestone tracking
create table if not exists progression (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  journey_id text,
  milestone text,
  achieved_at timestamptz default now(),
  metadata jsonb default '{}'
);

-- Processed messages: prevent duplicate processing
create table if not exists processed_messages (
  whatsapp_message_id text primary key,
  processed_at timestamptz default now()
);

create index if not exists idx_messages_session on messages(session_id);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_scores_user on scores(user_id);
create index if not exists idx_user_journeys_user on user_journeys(user_id);
