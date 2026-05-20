alter table journeys
  add column status text not null default 'draft'
  check (status in ('draft', 'published'));

-- Existing journeys should be published
update journeys set status = 'published' where deleted_at is null;
