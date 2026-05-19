-- Add deleted_at timestamptz to journeys and journey_steps
alter table journeys add column deleted_at timestamptz;
alter table journey_steps add column deleted_at timestamptz;
