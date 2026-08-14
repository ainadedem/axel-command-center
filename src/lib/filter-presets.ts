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

export interface FilterPresetsApi {
  presets: FilterPreset[];
  save: (name: string, statuses: string[], po: string[]) => void;
  remove: (id: string) => void;
}

export function useFilterPresets(route: string): FilterPresetsApi {
  const { user } = useAuth();
  const storeKey = keyFor(user?.id, route);
  const [presets, setPresets] = useState<FilterPreset[]>(() => read(storeKey));
  const [loadedFor, setLoadedFor] = useState(storeKey);

  if (loadedFor !== storeKey) {
    setLoadedFor(storeKey);
    setPresets(read(storeKey));
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

  const remove = useCallback((id: string) => persist(presets.filter((p) => p.id !== id)), [presets, persist]);

  return { presets, save, remove };
}
