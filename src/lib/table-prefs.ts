import { useCallback, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { ColumnDef } from "@/lib/column-prefs";

/**
 * Per-user, per-route table preferences: column visibility, order and widths.
 *
 * Everything lives under one localStorage key namespaced with the signed-in
 * user id, so two accounts on the same machine keep separate layouts and each
 * table route keeps its own settings.
 */

export type TablePrefsState = {
  hidden: string[];
  order: string[];
  widths: Record<string, number>;
};

const EMPTY: TablePrefsState = { hidden: [], order: [], widths: {} };

function keyFor(userId: string | undefined, route: string) {
  return `axel.table.${userId ?? "anon"}.${route}`;
}

function read(key: string): TablePrefsState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<TablePrefsState>;
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      order: Array.isArray(parsed.order) ? parsed.order : [],
      widths: parsed.widths && typeof parsed.widths === "object" ? parsed.widths : {},
    };
  } catch {
    return EMPTY;
  }
}

export interface TablePrefs {
  /** All columns in the user's current order. */
  columns: ColumnDef[];
  /** Only the columns that are currently visible, in order. */
  visible: ColumnDef[];
  visibleKeys: string[];
  count: number;
  on: (key: string) => boolean;
  toggle: (key: string) => void;
  width: (key: string) => number;
  /** CSS width string for a `<th>`. */
  cssWidth: (key: string) => string;
  startResize: (key: string) => (e: React.MouseEvent) => void;
  /** Native drag handlers that reorder a header column. */
  dragProps: (key: string) => {
    draggable: boolean;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    "data-drag-over"?: "left" | "right";
  };
  /** Live-region text describing the last keyboard reorder/resize. */
  announcement: string;
  /** Keyboard handlers for a header cell (Alt+Arrow reorder, Shift+Arrow resize). */
  keyboardProps: (key: string) => {
    tabIndex: number;
    "aria-label": string;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
  reset: () => void;
  resetWidths: () => void;
  resetOrder: () => void;
  isDefault: boolean;
  totalWidth: number;
}

export function useTablePrefs(
  route: string,
  columns: ColumnDef[],
  defaultWidths: Record<string, number>,
): TablePrefs {
  const { user } = useAuth();
  const storeKey = keyFor(user?.id, route);
  const [state, setState] = useState<TablePrefsState>(() => read(storeKey));
  const [loadedFor, setLoadedFor] = useState(storeKey);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // The user id resolves asynchronously — re-read once the key changes.
  if (loadedFor !== storeKey) {
    setLoadedFor(storeKey);
    setState(read(storeKey));
  }

  const persist = useCallback(
    (next: TablePrefsState) => {
      setState(next);
      try {
        window.localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory */
      }
    },
    [storeKey],
  );

  const ordered = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const out: ColumnDef[] = [];
    for (const k of state.order) {
      const c = byKey.get(k);
      if (c) {
        out.push(c);
        byKey.delete(k);
      }
    }
    for (const c of columns) if (byKey.has(c.key)) out.push(c);
    return out;
  }, [columns, state.order]);

  const on = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      const priority = col?.priority ?? "default";
      if (priority === "always") return true;
      if (state.hidden.includes(key)) return false;
      if (priority === "optional") return state.hidden.includes(`+${key}`);
      return true;
    },
    [columns, state.hidden],
  );

  const toggle = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      const priority = col?.priority ?? "default";
      if (priority === "always") return;
      const isOn = on(key);
      const hidden = new Set(state.hidden);
      if (isOn) {
        hidden.delete(`+${key}`);
        hidden.add(key);
      } else {
        hidden.delete(key);
        if (priority === "optional") hidden.add(`+${key}`);
      }
      persist({ ...state, hidden: [...hidden] });
    },
    [columns, on, persist, state],
  );


  const width = useCallback(
    (key: string) => state.widths[key] ?? defaultWidths[key] ?? 140,
    [state.widths, defaultWidths],
  );

  const startResize = useCallback(
    (key: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = width(key);
      let latest = startW;
      const onMove = (ev: MouseEvent) => {
        latest = Math.max(64, startW + (ev.clientX - startX));
        setState((s) => ({ ...s, widths: { ...s.widths, [key]: latest } }));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setState((s) => {
          const next = { ...s, widths: { ...s.widths, [key]: latest } };
          try {
            window.localStorage.setItem(storeKey, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [storeKey, width],
  );

  const move = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      const keys = ordered.map((c) => c.key);
      const fromIdx = keys.indexOf(from);
      const toIdx = keys.indexOf(to);
      if (fromIdx < 0 || toIdx < 0) return;
      keys.splice(toIdx, 0, keys.splice(fromIdx, 1)[0]);
      persist({ ...state, order: keys });
    },
    [ordered, persist, state],
  );

  const dragProps = useCallback(
    (key: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        setDragKey(key);
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", key);
        } catch {
          /* ignore */
        }
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragKey || dragKey === key) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (overKey !== key) setOverKey(key);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const from = dragKey ?? e.dataTransfer.getData("text/plain");
        if (from) move(from, key);
        setDragKey(null);
        setOverKey(null);
      },
      onDragEnd: () => {
        setDragKey(null);
        setOverKey(null);
      },
      ...(overKey === key ? { "data-drag-over": "right" as const } : {}),
    }),
    [dragKey, move, overKey],
  );

  const visible = ordered.filter((c) => on(c.key));

  const label = (key: string) => columns.find((c) => c.key === key)?.label ?? key;

  const setWidth = (key: string, next: number) => {
    persist({ ...state, widths: { ...state.widths, [key]: Math.max(64, Math.round(next)) } });
  };

  const moveBy = (key: string, delta: number) => {
    const keys = visible.map((c) => c.key);
    const i = keys.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= keys.length) return null;
    move(key, keys[j]);
    return `${label(key)} moved to position ${j + 1} of ${keys.length}.`;
  };

  /**
   * Keyboard equivalents for the mouse-only header drag and resize:
   * Alt+Arrow reorders the column, Shift+Arrow resizes it in 16px steps.
   */
  const keyboardProps = (key: string) => ({
    tabIndex: 0,
    "aria-label": `${label(key)} column. Alt plus arrow keys reorder, shift plus arrow keys resize.`,
    onKeyDown: (e: React.KeyboardEvent) => {
      const isLeft = e.key === "ArrowLeft";
      const isRight = e.key === "ArrowRight";
      if (!isLeft && !isRight) return;
      if (e.altKey) {
        e.preventDefault();
        const msg = moveBy(key, isLeft ? -1 : 1);
        if (msg) setAnnouncement(msg);
      } else if (e.shiftKey) {
        e.preventDefault();
        const next = Math.max(64, width(key) + (isLeft ? -16 : 16));
        setWidth(key, next);
        setAnnouncement(`${label(key)} column width ${next} pixels.`);
      }
    },
  });

  return {
    announcement,
    keyboardProps,
    columns: ordered,
    visible,
    visibleKeys: visible.map((c) => c.key),
    count: visible.length,
    on,
    toggle,
    setAll: (visible_: boolean) => {
      const hidden: string[] = [];
      for (const c of columns) {
        const priority = c.priority ?? "default";
        if (priority === "always") continue;
        if (visible_) {
          if (priority === "optional") hidden.push(`+${c.key}`);
        } else {
          hidden.push(c.key);
        }
      }
      persist({ ...state, hidden });
    },
    width,
    cssWidth: (key: string) => `${width(key)}px`,
    startResize,
    dragProps,
    reset: () => persist({ hidden: [], order: [], widths: {} }),
    resetWidths: () => persist({ ...state, widths: {} }),
    resetOrder: () => persist({ ...state, order: [] }),
    isDefault: state.hidden.length === 0,
    totalWidth: visible.reduce((s, c) => s + width(c.key), 0),
  };
}
