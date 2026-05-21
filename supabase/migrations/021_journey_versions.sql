alter table journeys
  add column version_number int not null default 1,
  add column parent_journey_id text references journeys(id) on delete set null;

alter table user_journeys
  add column journey_version_id text references journeys(id) on delete set null;

create index on journeys (parent_journey_id) where parent_journey_id is not null;
create index on user_journeys (journey_version_id);
