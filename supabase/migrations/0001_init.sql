-- Postgres port of ingestion/schema.sql for hosted Supabase.
-- Apply after creating the project. The public site reads published JSON;
-- this warehouse is for ingestion, audit, and optional server queries.

create table if not exists data_sources (
  id text primary key,
  name text not null,
  official_url text not null,
  dataset_kind text not null check (dataset_kind in ('registrations', 'vehicle_fleet', 'inspections')),
  expected_interval_days integer not null,
  trusted_host text not null
);

create table if not exists source_resources (
  id text primary key,
  source_id text not null references data_sources(id),
  source_url text not null unique,
  title text,
  reporting_period text,
  snapshot_date text,
  resource_kind text not null,
  layout_hint text,
  discovered_at timestamptz not null
);

create table if not exists source_files (
  id text primary key,
  resource_id text not null references source_resources(id),
  local_path text not null,
  sha256 text not null,
  byte_size integer not null,
  retrieved_at timestamptz not null,
  content_type text,
  unique (resource_id, sha256)
);

create table if not exists import_runs (
  id text primary key,
  source_id text not null references data_sources(id),
  file_id text references source_files(id),
  command text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  records_staged integer default 0,
  records_published integer default 0,
  error_summary text
);

create table if not exists registration_facts (
  id bigserial primary key,
  source_file_id text not null references source_files(id),
  import_run_id text not null references import_runs(id),
  reporting_period text not null,
  metric_code text not null,
  category_code text,
  eu_category text,
  brand_slug text,
  brand_source text,
  model_source text,
  fuel_code text,
  fuel_source text,
  vehicle_first_reg_year integer,
  value double precision not null,
  unit text not null,
  publication_status text not null default 'published',
  extra_json jsonb
);

create unique index if not exists uq_registration_facts on registration_facts (
  source_file_id, reporting_period, metric_code,
  coalesce(category_code, ''), coalesce(eu_category, ''),
  coalesce(brand_slug, ''), coalesce(model_source, ''),
  coalesce(fuel_code, ''), coalesce(vehicle_first_reg_year, -1)
);

alter table registration_facts enable row level security;
create policy published_registrations_read on registration_facts
  for select using (publication_status = 'published');
