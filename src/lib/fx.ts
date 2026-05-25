// Live FX rates — MGA per unit of currency.
// Refreshes once per day from open.er-api.com (free, no key, CORS-enabled).
// Falls back to the seed values shipped in mock-data.
import { useEffect, useState } from "react";
import { FX, type Currency } from "./mock-data";

const STORAGE_KEY = "axel.fx.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export type FxSource = "seed" | "live" | "cache";
export interface FxSnapshot {
  rates: Record<Currency, number>; // MGA per 1 unit of currency
  updatedAt: string | null; // ISO date
  source: FxSource;
}

let snapshot: FxSnapshot = {
  rates: { ...FX },
  updatedAt: null,
  source: "seed",
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function applySnapshot(next: FxSnapshot) {
  snapshot = next;
  // Mutate the shared FX object in place so existing toMGA() callers see new values.
  (Object.keys(next.rates) as Currency[]).forEach((k) => { FX[k] = next.rates[k]; });
  emit();
}

function loadFromStorage(): FxSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxSnapshot;
    if (!parsed?.rates?.MGA || !parsed?.rates?.EUR || !parsed?.rates?.USD) return null;
    return parsed;
  } catch { return null; }
}

function saveToStorage(s: FxSnapshot) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function isStale(updatedAt: string | null): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  return !Number.isFinite(t) || Date.now() - t > DAY_MS;
}

async function fetchLiveRates(): Promise<FxSnapshot | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const json = await res.json() as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (json.result !== "success" || !json.rates) return null;
    const mgaPerUsd = Number(json.rates.MGA);
    const eurPerUsd = Number(json.rates.EUR);
    if (!Number.isFinite(mgaPerUsd) || !Number.isFinite(eurPerUsd) || eurPerUsd <= 0) return null;
    return {
      rates: {
        MGA: 1,
        USD: Math.round(mgaPerUsd),
        EUR: Math.round(mgaPerUsd / eurPerUsd),
      },
      updatedAt: new Date().toISOString(),
      source: "live",
    };
  } catch { return null; }
}

let initialized = false;
export async function initFxRates(force = false): Promise<void> {
  if (initialized && !force) return;
  initialized = true;

  // Hydrate from cache immediately.
  const cached = loadFromStorage();
  if (cached) applySnapshot({ ...cached, source: "cache" });

  if (!force && cached && !isStale(cached.updatedAt)) return;

  const live = await fetchLiveRates();
  if (live) {
    applySnapshot(live);
    saveToStorage(live);
  }
}

export function refreshFxRates() { return initFxRates(true); }

export function useFxRates(): FxSnapshot & { refresh: () => Promise<void> } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    initFxRates();
    return () => { listeners.delete(l); };
  }, []);
  return { ...snapshot, refresh: refreshFxRates };
}
