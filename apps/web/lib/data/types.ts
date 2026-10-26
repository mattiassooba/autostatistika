export type TabId = "registreerimised" | "soidukipark" | "ulevaatused";

export type TotalsRow = {
  reporting_period: string;
  category_code: string | null;
  metric_code: string;
  value: number;
};

export type BrandRow = {
  reporting_period: string;
  category_code: string | null;
  brand_slug: string;
  brand_source: string;
  value: number;
};

export type FuelRow = {
  reporting_period: string;
  category_code: string | null;
  fuel_code: string;
  fuel_source: string;
  metric_code: string;
  value: number;
};

export type ModelRow = {
  reporting_period: string;
  category_code: string | null;
  brand_slug: string;
  brand_source: string;
  model_source: string;
  value: number;
};

/** New vehicles split one dimension at a time (Infoleht "Uued sõidukid"). */
export type BreakdownRow = {
  reporting_period: string;
  category_code: string | null;
  dimension: string;
  dimension_value: string;
  value: number;
};

export type PublishedBundle = {
  generatedAt: string;
  disclaimer: { et: string; en: string };
  registrations: {
    totals: TotalsRow[];
    brands: BrandRow[];
    breakdowns?: BreakdownRow[];
    fuels: FuelRow[];
    models: ModelRow[];
  };
  fleet: {
    snapshots: Array<{
      snapshot_date: string;
      category_code: string | null;
      status_code: string | null;
      value: number;
    }>;
    brands: Array<{
      snapshot_date: string;
      category_code: string | null;
      brand_slug: string;
      brand_source: string;
      value: number;
      /** false: the source's "most registered" top list, not a full split. */
      complete?: boolean;
    }>;
    regions: Array<{
      snapshot_date: string;
      category_code: string | null;
      region_code: string;
      region_source: string;
      value: number;
    }>;
    ages: Array<{
      snapshot_date: string;
      category_code: string | null;
      age_band: string;
      value: number;
    }>;
    /** Dates counted from the open register files; retroactive: queried later (2025). */
    sources?: FleetSource[];
  };
  inspections: {
    national: Array<{
      reporting_period: string;
      population: string;
      metric_code: string;
      value: number;
    }>;
    stations: Array<{
      reporting_period: string;
      population: string;
      station_code?: string | null;
      station_name: string | null;
      metric_code: string;
      value: number;
    }>;
  };
  insights: Array<{
    tab: TabId;
    period: string;
    generationMode: string;
    title: { et: string; en: string };
    body: { et: string; en: string };
    evidence: Array<{ metric: string; period: string; entity: string; value: number; unit: string }>;
  }>;
};

export type Insight = PublishedBundle["insights"][number];

/** The slice of the bundle the client explorer needs. */
export type ExplorerData = Pick<
  PublishedBundle,
  "generatedAt" | "disclaimer" | "registrations" | "fleet" | "inspections" | "insights"
>;

export type DashboardQuery = {
  tab: TabId;
  category?: string;
  brands: string[];
  from?: string;
  to?: string;
  fuel?: string;
  snapshot?: string;
  population?: string;
};

export type FleetSource = { snapshot_date: string; source: "register"; retroactive: boolean };
