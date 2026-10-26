-- New vehicles split one dimension at a time (county, gearbox, power_band, colour).
alter table registration_facts add column if not exists dimension text;
alter table registration_facts add column if not exists dimension_value text;

drop index if exists uq_registration_facts;
create unique index if not exists uq_registration_facts on registration_facts (
  source_file_id,
  reporting_period,
  metric_code,
  coalesce(category_code, ''),
  coalesce(eu_category, ''),
  coalesce(brand_slug, ''),
  coalesce(model_source, ''),
  coalesce(fuel_code, ''),
  coalesce(vehicle_first_reg_year, -1),
  coalesce(dimension, ''),
  coalesce(dimension_value, '')
);
