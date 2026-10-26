"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useDashboard } from "../dashboard-context";
import { brandCategoriesOf, brandPeriodsOf } from "@/lib/data/views";
import { MAX_COMPARE } from "@/lib/design/tokens";

type HeroState = {
  categories: string[];
  category: string;
  /** A vehicle type whose brand data is still loading. */
  pendingCategory: string | null;
  selectCategory: (category: string) => void;
  /** Months with a brand ranking for the category. */
  periods: string[];
  period: string;
  setPeriod: (period: string) => void;
  /** Brands picked for comparison, in pick order. */
  selected: string[];
  toggleBrand: (slug: string) => void;
  clearBrands: () => void;
  /** Brands with a page at /margid/<slug>. */
  brandPages: ReadonlySet<string>;
};

const Context = createContext<HeroState | null>(null);

/**
 * One selected month and vehicle type for the whole hero: the headline figures,
 * the brand ranking and the timeline read and write the same state.
 */
export function HeroProvider({ brandPages, children }: { brandPages: string[]; children: ReactNode }) {
  const { data, ensureSlices, hasSlices } = useDashboard();
  const categories = useMemo(() => brandCategoriesOf(data), [data]);
  const [category, setCategory] = useState(categories.includes("passenger_car") ? "passenger_car" : categories[0]);
  const [pendingCategory, setPending] = useState<string | null>(null);
  const periods = useMemo(() => brandPeriodsOf(data, category), [data, category]);
  const [requested, setRequested] = useState(periods[periods.length - 1]);
  const [selected, setSelected] = useState<string[]>([]);
  const latestRequest = useRef<string | null>(null);

  const period = periods.includes(requested) ? requested : periods[periods.length - 1];

  const selectCategory = useCallback(
    (next: string) => {
      latestRequest.current = next;
      const apply = () => {
        // A newer choice may have been made while this one loaded.
        if (latestRequest.current !== next) return;
        setCategory(next);
        setPending(null);
        setSelected([]);
      };
      if (hasSlices([`brands:${next}`])) {
        apply();
        return;
      }
      setPending(next);
      ensureSlices([`brands:${next}`])
        .then(apply)
        .catch(() => {
          if (latestRequest.current === next) setPending(null);
        });
    },
    [ensureSlices, hasSlices],
  );

  const toggleBrand = useCallback((slug: string) => {
    setSelected((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(-MAX_COMPARE),
    );
  }, []);
  const clearBrands = useCallback(() => setSelected([]), []);
  const pages = useMemo(() => new Set(brandPages), [brandPages]);

  const value = useMemo(
    () => ({
      categories,
      category,
      pendingCategory,
      selectCategory,
      periods,
      period,
      setPeriod: setRequested,
      selected,
      toggleBrand,
      clearBrands,
      brandPages: pages,
    }),
    [categories, category, pendingCategory, selectCategory, periods, period, selected, toggleBrand, clearBrands, pages],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHero(): HeroState {
  const value = useContext(Context);
  if (!value) throw new Error("useHero must be used inside HeroProvider");
  return value;
}
