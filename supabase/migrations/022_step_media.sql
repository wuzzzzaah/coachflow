alter table journey_steps
  add column media_url  text,
  add column media_type text check (media_type in ('image', 'document', 'audio', 'video'));
