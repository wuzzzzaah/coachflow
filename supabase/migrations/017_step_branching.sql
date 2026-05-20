alter table journey_steps
  add column branch_on_low_score     boolean not null default false,
  add column branch_score_threshold  numeric,          -- if score < this value, take branch
  add column branch_step_index       int;              -- index of the step to branch to
