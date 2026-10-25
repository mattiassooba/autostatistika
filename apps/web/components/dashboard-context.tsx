"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DashboardQuery } from "@/lib/data/types";
import { resolveView, type ResolvedView } from "@/lib/data/resolve";
import {
  buildExplorerData,
  requiredSlices,
  type CorePayload,
  type ExplorerDataWithCatalog,
  sliceUrl,
  type SlicePayload,
} from "@/lib/data/slices";
import { parseQuery, toSearchParams } from "@/lib/url-state";

type Update = Partial<DashboardQuery> | ((current: DashboardQuery) => DashboardQuery);

type DashboardContextValue = {
  data: ExplorerDataWithCatalog;
  /** The selection the user asked for (controls render this immediately). */
  query: DashboardQuery;
  requestedView: ResolvedView;
  /** The selection whose data is loaded (panels render this). */
  view: ResolvedView;
  pending: boolean;
  error: boolean;
  retry: () => void;
  update: (next: Update, options?: { scrollTo?: string }) => void;
  reset: () => void;
  shareUrl: () => string;
  ensureSlices: (keys: string[]) => Promise<void>;
  hasSlices: (keys: string[]) => boolean;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  core,
  initialSlices,
  initialQuery,
  children,
}: {
  core: CorePayload;
  initialSlices: SlicePayload[];
  initialQuery: DashboardQuery;
  children: ReactNode;
}) {
  const [slices, setSlices] = useState<Record<string, SlicePayload>>(() =>
    Object.fromEntries(initialSlices.map((slice) => [slice.key, slice])),
  );
  const [query, setQuery] = useState<DashboardQuery>(initialQuery);
  const [shown, setShown] = useState<DashboardQuery>(initialQuery);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loaded = useRef(new Set(Object.keys(slices)));
  const inflight = useRef(new Map<string, Promise<void>>());
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const pendingScroll = useRef<string | null>(null);
  const firstRender = useRef(true);

  const data = useMemo(() => buildExplorerData(core, Object.values(slices)), [core, slices]);
  const requestedView = useMemo(() => resolveView(data, query), [data, query]);
  const view = useMemo(() => resolveView(data, shown), [data, shown]);

  const hasSlices = useCallback((keys: string[]) => keys.every((key) => loaded.current.has(key)), []);

  const ensureSlices = useCallback(async (keys: string[]) => {
    const missing = keys.filter((key) => !loaded.current.has(key) && !inflight.current.has(key));
    const waiting = keys.map((key) => inflight.current.get(key)).filter(Boolean) as Promise<void>[];
    if (missing.length) {
      const request = Promise.all(
        missing.map((key) =>
          fetch(sliceUrl(core.generatedAt, key)).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<SlicePayload>;
          }),
        ),
      )
        .then((fetched) => {
          fetched.forEach((slice) => loaded.current.add(slice.key));
          setSlices((current) => ({ ...current, ...Object.fromEntries(fetched.map((slice) => [slice.key, slice])) }));
        })
        .finally(() => missing.forEach((key) => inflight.current.delete(key)));
      missing.forEach((key) => inflight.current.set(key, request));
      waiting.push(request);
    }
    await Promise.all(waiting);
  }, [core.generatedAt]);

  // The page is pre-rendered with the default view; apply a shared link's query
  // once in the browser.
  useEffect(() => {
    if (!window.location.search) return;
    setQuery(parseQuery(Object.fromEntries(new URLSearchParams(window.location.search))));
  }, []);

  // Load what the requested view needs; switch the displayed view once it is in.
  useEffect(() => {
    const keys = requiredSlices(requestedView, core.catalog);
    if (hasSlices(keys)) {
      setShown(query);
      setError(false);
      return;
    }
    let cancelled = false;
    ensureSlices(keys)
      .then(() => {
        if (cancelled || latestQuery.current !== query) return;
        setShown(query);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [query, requestedView, core.catalog, ensureSlices, hasSlices, attempt]);

  // Mirror the requested state into the URL without a server round trip.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = toSearchParams(query).toString();
    const url = `${window.location.pathname}?${params}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
  }, [query]);

  // Scroll after the displayed view caught up, so the target has its content.
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target || shown !== query) return;
    pendingScroll.current = null;
    const el = document.getElementById(target);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  }, [shown, query]);

  const update = useCallback((next: Update, options?: { scrollTo?: string }) => {
    if (options?.scrollTo) pendingScroll.current = options.scrollTo;
    setQuery((current) => (typeof next === "function" ? next(current) : { ...current, ...next }));
  }, []);

  const reset = useCallback(() => {
    setQuery((current) => ({ tab: current.tab, brands: [] }));
  }, []);

  const shareUrl = useCallback(() => {
    const params = toSearchParams(query).toString();
    return `${window.location.origin}${window.location.pathname}?${params}`;
  }, [query]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({
      data,
      query,
      requestedView,
      view,
      pending: shown !== query,
      error,
      retry,
      update,
      reset,
      shareUrl,
      ensureSlices,
      hasSlices,
    }),
    [data, query, requestedView, view, shown, error, retry, update, reset, shareUrl, ensureSlices, hasSlices],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("useDashboard must be used inside DashboardProvider");
  return value;
}
