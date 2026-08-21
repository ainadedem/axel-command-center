import { useCallback, useEffect, useMemo, useState } from "react";

export type FieldType = "string" | "number" | "date" | "enum" | "boolean";

export type FieldDef<T> = {
  key: string;
  label: string;
  type: FieldType;
  accessor: (item: T) => unknown;
  /** Optional value used for sorting/group ordering instead of the displayed accessor value. */
  sortAccessor?: (item: T) => unknown;
  /** Order groups ascending (default) or descending by their sort key. */
  groupOrder?: "asc" | "desc";
  /** Optional explicit enum options (otherwise derived from data). */
  enumOptions?: string[];
  /** Disable sorting on this field. */
  noSort?: boolean;
  /** Disable grouping on this field. */
  noGroup?: boolean;
  /** Disable filtering on this field. */
  noFilter?: boolean;
};

export type SortState = { key: string; dir: "asc" | "desc" } | null;
export type GroupState = { key: string } | null;
export type FilterValue =
  | { type: "enum"; values: string[] }
  | { type: "text"; value: string }
  | { type: "number"; min?: number; max?: number }
  | { type: "date"; from?: string; to?: string }
  | { type: "boolean"; value: boolean };
export type FilterState = Record<string, FilterValue | undefined>;

export type ViewState = {
  sort: SortState;
  group: GroupState;
  filters: FilterState;
  q: string;
};

const DEFAULT_VIEW: ViewState = { sort: null, group: null, filters: {}, q: "" };

function load(key: string): ViewState {
  if (typeof window === "undefined") return DEFAULT_VIEW;
  try {
    const raw = localStorage.getItem(`view:${key}`);
    if (!raw) return DEFAULT_VIEW;
    const parsed = JSON.parse(raw) as Partial<ViewState>;
    return { ...DEFAULT_VIEW, ...parsed, filters: parsed.filters ?? {} };
  } catch {
    return DEFAULT_VIEW;
  }
}

function save(key: string, state: ViewState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`view:${key}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function toComparable(v: unknown, type: FieldType): number | string {
  if (v == null) return type === "number" || type === "date" ? -Infinity : "";
  if (type === "number") return Number(v) || 0;
  if (type === "date") {
    const d = typeof v === "string" ? Date.parse(v) : NaN;
    return Number.isNaN(d) ? -Infinity : d;
  }
  if (type === "boolean") return v ? 1 : 0;
  return String(v).toLowerCase();
}

function matchFilter<T>(item: T, def: FieldDef<T>, fv: FilterValue): boolean {
  const v = def.accessor(item);
  if (fv.type === "enum") {
    if (fv.values.length === 0) return true;
    const s = v == null ? "" : String(v);
    return fv.values.includes(s);
  }
  if (fv.type === "text") {
    if (!fv.value) return true;
    return String(v ?? "").toLowerCase().includes(fv.value.toLowerCase());
  }
  if (fv.type === "number") {
    const n = Number(v);
    if (Number.isNaN(n)) return false;
    if (fv.min != null && n < fv.min) return false;
    if (fv.max != null && n > fv.max) return false;
    return true;
  }
  if (fv.type === "date") {
    const s = v == null ? "" : String(v);
    if (fv.from && s < fv.from) return false;
    if (fv.to && s > fv.to) return false;
    return true;
  }
  if (fv.type === "boolean") {
    return Boolean(v) === fv.value;
  }
  return true;
}

export type GroupedResult<T> = { key: string; label: string; items: T[] };

export function useDataView<T>(storageKey: string, fields: FieldDef<T>[]) {
  const [state, setStateRaw] = useState<ViewState>(() => load(storageKey));

  useEffect(() => { save(storageKey, state); }, [storageKey, state]);

  const setState = useCallback((updater: ViewState | ((prev: ViewState) => ViewState)) => {
    setStateRaw((prev) => (typeof updater === "function" ? (updater as (p: ViewState) => ViewState)(prev) : updater));
  }, []);

  const fieldMap = useMemo(() => {
    const m = new Map<string, FieldDef<T>>();
    for (const f of fields) m.set(f.key, f);
    return m;
  }, [fields]);

  const apply = useCallback((items: T[]): GroupedResult<T>[] => {
    let out = items;

    // Global text search across all string fields
    if (state.q) {
      const qq = state.q.toLowerCase();
      out = out.filter((it) =>
        fields.some((f) => {
          const v = f.accessor(it);
          return v != null && String(v).toLowerCase().includes(qq);
        }),
      );
    }

    // Field filters
    for (const [key, fv] of Object.entries(state.filters)) {
      if (!fv) continue;
      const def = fieldMap.get(key);
      if (!def) continue;
      out = out.filter((it) => matchFilter(it, def, fv));
    }

    // Sort
    if (state.sort) {
      const def = fieldMap.get(state.sort.key);
      if (def) {
        const dir = state.sort.dir === "asc" ? 1 : -1;
        const val = (it: T) =>
          def.sortAccessor ? toComparable(def.sortAccessor(it), "string") : toComparable(def.accessor(it), def.type);
        out = [...out].sort((a, b) => {
          const av = val(a);
          const bv = val(b);
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
      }
    }

    // Group
    if (state.group) {
      const def = fieldMap.get(state.group.key);
      if (def) {
        const map = new Map<string, { label: string; sortKey: string; items: T[] }>();
        for (const it of out) {
          const raw = def.accessor(it);
          const label = raw == null || raw === "" ? "—" : String(raw);
          const rawSort = def.sortAccessor ? def.sortAccessor(it) : raw;
          const sortKey = rawSort == null || rawSort === "" ? "" : String(rawSort);
          const bucket = map.get(label) ?? { label, sortKey, items: [] };
          bucket.items.push(it);
          map.set(label, bucket);
        }
        const gdir = def.groupOrder === "desc" ? -1 : 1;
        return Array.from(map.values())
          .sort((a, b) => (a.sortKey < b.sortKey ? -1 * gdir : a.sortKey > b.sortKey ? 1 * gdir : 0))
          .map((g) => ({ key: g.label, label: g.label, items: g.items }));
      }
    }


    return [{ key: "__all__", label: "All", items: out }];
  }, [state, fields, fieldMap]);

  const reset = useCallback(() => setStateRaw(DEFAULT_VIEW), []);
  const activeFilterCount = Object.values(state.filters).filter(Boolean).length + (state.q ? 1 : 0);

  return { state, setState, apply, reset, fields, activeFilterCount };
}
