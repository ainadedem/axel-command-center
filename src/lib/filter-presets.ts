import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Saved status + PO chip combinations, stored per user and per table route so
 * common views ("Overdue with missing PO") are one click away.
 */
export interface FilterPreset {
  id: string;
  name: string;
  statuses: string[];
  po: string[];
}

function keyFor(userId: string | undefined, route: string) {
  return `axel.filterPresets.${userId ?? "anon"}.${route}`;
}

function read(key: string): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.name === "string")
      .map((p) => ({
        id: String(p.id ?? p.name),
        name: String(p.name),
        statuses: Array.isArray(p.statuses) ? p.statuses.map(String) : [],
        po: Array.isArray(p.po) ? p.po.map(String) : [],
      }));
  } catch {
    return [];
  }
}

/** Starter presets are seeded once per user + route, then owned by the user. */
function seed(key: string, defaults: FilterPreset[]): FilterPreset[] {
  if (typeof window === "undefined" || defaults.length === 0) return [];
  const flag = `${key}.seeded`;
  try {
    if (window.localStorage.getItem(flag)) return [];
    window.localStorage.setItem(flag, "1");
    window.localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  } catch {
    return defaults;
  }
}

function load(key: string, defaults: FilterPreset[]): FilterPreset[] {
  const existing = read(key);
  if (existing.length > 0) return existing;
  return seed(key, defaults);
}

export interface FilterPresetsApi {
  presets: FilterPreset[];
  save: (name: string, statuses: string[], po: string[]) => void;
  rename: (id: string, name: string) => void;
  /** Overwrite a preset's filters with the current selection. */
  update: (id: string, statuses: string[], po: string[]) => void;
  remove: (id: string) => void;
}

export function useFilterPresets(route: string, defaults: FilterPreset[] = []): FilterPresetsApi {
  const { user } = useAuth();
  const storeKey = keyFor(user?.id, route);
  const [presets, setPresets] = useState<FilterPreset[]>(() => load(storeKey, defaults));
  const [loadedFor, setLoadedFor] = useState(storeKey);

  if (loadedFor !== storeKey) {
    setLoadedFor(storeKey);
    setPresets(load(storeKey, defaults));
  }

  const persist = useCallback(
    (next: FilterPreset[]) => {
      setPresets(next);
      try {
        window.localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory */
      }
    },
    [storeKey],
  );

  const save = useCallback(
    (name: string, statuses: string[], po: string[]) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const next = presets.filter((p) => p.name.toLowerCase() !== trimmed.toLowerCase());
      next.push({ id: `${Date.now()}`, name: trimmed, statuses, po });
      persist(next);
    },
    [presets, persist],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      persist(presets.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    },
    [presets, persist],
  );

  const update = useCallback(
    (id: string, statuses: string[], po: string[]) => {
      persist(presets.map((p) => (p.id === id ? { ...p, statuses, po } : p)));
    },
    [presets, persist],
  );

  const remove = useCallback((id: string) => persist(presets.filter((p) => p.id !== id)), [presets, persist]);

  return { presets, save, rename, update, remove };
}
