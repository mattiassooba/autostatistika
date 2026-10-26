CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  official_url TEXT NOT NULL,
  dataset_kind TEXT NOT NULL CHECK (dataset_kind IN ('registrations', 'vehicle_fleet', 'inspections')),
  expected_interval_days INTEGER NOT NULL,
  trusted_host TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_resources (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  source_url TEXT NOT NULL UNIQUE,
  title TEXT,
  reporting_period TEXT,
  snapshot_date TEXT,
  resource_kind TEXT NOT NULL,
  layout_hint TEXT,
  discovered_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES source_resources(id),
  local_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  retrieved_at TEXT NOT NULL,
  content_type TEXT,
  UNIQUE (resource_id, sha256)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES data_sources(id),
  file_id TEXT REFERENCES source_files(id),
  command TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'published', 'quarantined', 'failed')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  records_staged INTEGER DEFAULT 0,
  records_published INTEGER DEFAULT 0,
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS import_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES import_runs(id),
  severity TEXT NOT NULL CHECK (severity IN ('error', 'warning')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_categories (
  code TEXT PRIMARY KEY,
  label_et TEXT NOT NULL,
  label_en TEXT NOT NULL,
  eu_codes TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_brands (
  slug TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  mapping_status TEXT NOT NULL DEFAULT 'canonical'
);

CREATE TABLE IF NOT EXISTS brand_aliases (
  source_value TEXT PRIMARY KEY,
  brand_slug TEXT REFERENCES vehicle_brands(slug),
  mapping_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fuel_types (
  code TEXT PRIMARY KEY,
  label_et TEXT NOT NULL,
  label_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regions (
  code TEXT PRIMARY KEY,
  label_et TEXT NOT NULL,
  label_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_statuses (
  code TEXT PRIMARY KEY,
  label_et TEXT NOT NULL,
  label_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_definitions (
  code TEXT PRIMARY KEY,
  unit TEXT NOT NULL,
  label_et TEXT NOT NULL,
  label_en TEXT NOT NULL,
  definition TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id TEXT NOT NULL REFERENCES source_files(id),
  import_run_id TEXT NOT NULL REFERENCES import_runs(id),
  reporting_period TEXT NOT NULL,
  metric_code TEXT NOT NULL REFERENCES metric_definitions(code),
  category_code TEXT REFERENCES vehicle_categories(code),
  eu_category TEXT,
  brand_slug TEXT,
  brand_source TEXT,
  model_source TEXT,
  fuel_code TEXT REFERENCES fuel_types(code),
  fuel_source TEXT,
  vehicle_first_reg_year INTEGER,
  -- One-dimensional breakdown of a total (county, gearbox, power_band, colour).
  dimension TEXT,
  dimension_value TEXT,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'published',
  extra_json TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_registration_facts ON registration_facts (
  source_file_id,
  reporting_period,
  metric_code,
  IFNULL(category_code, ''),
  IFNULL(eu_category, ''),
  IFNULL(brand_slug, ''),
  IFNULL(model_source, ''),
  IFNULL(fuel_code, ''),
  IFNULL(vehicle_first_reg_year, -1),
  IFNULL(dimension, ''),
  IFNULL(dimension_value, '')
);

CREATE TABLE IF NOT EXISTS vehicle_fleet_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id TEXT NOT NULL REFERENCES source_files(id),
  import_run_id TEXT NOT NULL REFERENCES import_runs(id),
  snapshot_date TEXT NOT NULL,
  metric_code TEXT NOT NULL REFERENCES metric_definitions(code),
  category_code TEXT REFERENCES vehicle_categories(code),
  eu_category TEXT,
  brand_slug TEXT,
  brand_source TEXT,
  model_source TEXT,
  fuel_code TEXT REFERENCES fuel_types(code),
  region_code TEXT REFERENCES regions(code),
  region_source TEXT,
  status_code TEXT REFERENCES registration_statuses(code),
  age_band TEXT,
  manufacture_year INTEGER,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'published',
  extra_json TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicle_fleet_facts ON vehicle_fleet_facts (
  source_file_id,
  snapshot_date,
  metric_code,
  IFNULL(category_code, ''),
  IFNULL(eu_category, ''),
  IFNULL(brand_slug, ''),
  IFNULL(model_source, ''),
  IFNULL(fuel_code, ''),
  IFNULL(region_code, ''),
  IFNULL(status_code, ''),
  IFNULL(age_band, ''),
  IFNULL(manufacture_year, -1)
);

CREATE TABLE IF NOT EXISTS inspection_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id TEXT NOT NULL REFERENCES source_files(id),
  import_run_id TEXT NOT NULL REFERENCES import_runs(id),
  reporting_period TEXT NOT NULL,
  metric_code TEXT NOT NULL REFERENCES metric_definitions(code),
  population TEXT NOT NULL,
  station_code TEXT,
  station_name TEXT,
  bureau_code TEXT,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'published',
  extra_json TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inspection_facts ON inspection_facts (
  source_file_id,
  reporting_period,
  metric_code,
  population,
  IFNULL(station_code, ''),
  IFNULL(bureau_code, '')
);

CREATE TABLE IF NOT EXISTS dataset_coverage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_kind TEXT NOT NULL,
  metric_code TEXT NOT NULL,
  period TEXT NOT NULL,
  category_code TEXT,
  geographic_level TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dataset_coverage ON dataset_coverage (
  dataset_kind, metric_code, period, IFNULL(category_code, ''), geographic_level
);

CREATE TABLE IF NOT EXISTS data_quality_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES import_runs(id),
  check_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  passed INTEGER NOT NULL,
  details TEXT
);

CREATE TABLE IF NOT EXISTS generated_insights (
  id TEXT PRIMARY KEY,
  locale TEXT NOT NULL,
  tab TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  period TEXT NOT NULL,
  generation_mode TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL,
  evidence_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insight_evidence (
  insight_id TEXT NOT NULL REFERENCES generated_insights(id),
  metric_code TEXT NOT NULL,
  period TEXT NOT NULL,
  entity TEXT,
  value REAL NOT NULL,
  unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_heartbeat (
  source_id TEXT PRIMARY KEY REFERENCES data_sources(id),
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_status TEXT,
  latest_period TEXT
);

CREATE INDEX IF NOT EXISTS idx_reg_period ON registration_facts(reporting_period, metric_code, category_code);
CREATE INDEX IF NOT EXISTS idx_reg_brand ON registration_facts(brand_slug, reporting_period);
CREATE INDEX IF NOT EXISTS idx_fleet_snap ON vehicle_fleet_facts(snapshot_date, category_code);
CREATE INDEX IF NOT EXISTS idx_insp_period ON inspection_facts(reporting_period, population, metric_code);
