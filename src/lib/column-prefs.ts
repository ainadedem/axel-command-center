import { useCallback, useMemo, useState } from "react";

export type ColumnPriority = "always" | "default" | "optional";

export interface ColumnDef {
  /** Stable key used for persistence. */
  key: string;
  /** Human label shown in the column picker. */
  label: string;
  /**
   * always   — cannot be hidden (identity / key columns)
   * default  — visible unless the user turns it off
   * optional — hidden unless the user turns it on
   */
  priority?: ColumnPriority;
}

const storageKey = (page: string) => `axel.columns.${page}`;

function readStored(page: string): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(page));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : null;
  } catch {
    return null;
  }
}

function defaultsFor(columns: ColumnDef[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const c of columns) out[c.key] = (c.priority ?? "default") !== "optional";
  return out;
}

export interface ColumnPrefs {
  columns: ColumnDef[];
  /** Is the column currently rendered? */
  on: (key: string) => boolean;
  toggle: (key: string) => void;
  reset: () => void;
  /** Number of visible columns — handy for `colSpan`. */
  count: number;
  visibleKeys: string[];
  isDefault: boolean;
}

/**
 * Per-page column visibility, persisted in localStorage.
 *
 * Lists render a prioritised subset of columns so the table always fits the
 * viewport (no horizontal scrolling); everything else can be switched on from
 * the column picker.
 */
export function useColumnPrefs(page: string, columns: ColumnDef[]): ColumnPrefs {
  const base = useMemo(() => defaultsFor(columns), [columns]);
  const [state, setState] = useState<Record<string, boolean>>(() => ({ ...base, ...(readStored(page) ?? {}) }));

  const persist = useCallback(
    (next: Record<string, boolean>) => {
      setState(next);
      try {
        window.localStorage.setItem(storageKey(page), JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory only */
      }
    },
    [page],
  );

  const on = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (col && (col.priority ?? "default") === "always") return true;
      return state[key] ?? base[key] ?? true;
    },
    [columns, state, base],
  );

  const toggle = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (col && (col.priority ?? "default") === "always") return;
      persist({ ...base, ...state, [key]: !(state[key] ?? base[key] ?? true) });
    },
    [columns, state, base, persist],
  );

  const reset = useCallback(() => persist({ ...base }), [base, persist]);

  const visibleKeys = columns.filter((c) => on(c.key)).map((c) => c.key);

  return {
    columns,
    on,
    toggle,
    reset,
    count: visibleKeys.length,
    visibleKeys,
    isDefault: columns.every((c) => on(c.key) === ((c.priority ?? "default") !== "optional")),
  };
}
