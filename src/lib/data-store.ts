// Lightweight reactive in-memory store with localStorage persistence.
// Each collection mutates an exported array IN PLACE so non-subscribing
// readers also see fresh data on next render.
import { useSyncExternalStore } from "react";

type WithId = { id: string };

const STORAGE_PREFIX = "axel.v1.";

function load<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface CollectionSync<T extends WithId> {
  /** Insert/upsert to remote. Resolve with canonical (DB) id, or null to skip. */
  upsert?: (item: T) => Promise<string | null>;
  /** Delete remote row by id. */
  remove?: (id: string) => Promise<void>;
}

export interface Collection<T extends WithId> {
  items: T[];
  add: (item: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  replaceAll: (next: T[]) => void;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => T[];
  /** Register sync hooks (called after each mutation, fire-and-forget). */
  setSync: (sync: CollectionSync<T>) => void;
}

export function createCollection<T extends WithId>(key: string, initial: T[]): Collection<T> {
  const hydrated = load<T>(key, initial);
  const items: T[] = [...hydrated];
  const listeners = new Set<() => void>();
  let snapshot: T[] = [...items];
  let sync: CollectionSync<T> = {};

  const emit = () => {
    snapshot = [...items];
    save(key, items);
    listeners.forEach((l) => l());
  };

  const swapId = (localId: string, dbId: string) => {
    if (localId === dbId) return;
    const i = items.findIndex((x) => x.id === localId);
    if (i >= 0) {
      items[i] = { ...items[i], id: dbId };
      emit();
    }
  };

  return {
    items,
    add(item) {
      items.push(item);
      emit();
      if (sync.upsert) {
        sync.upsert(item).then((dbId) => { if (dbId) swapId(item.id, dbId); })
          .catch((e) => console.warn(`[sync ${key}] upsert`, e));
      }
    },
    update(id, patch) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        items[i] = { ...items[i], ...patch };
        emit();
        if (sync.upsert) {
          const snap = items[i];
          sync.upsert(snap).catch((e) => console.warn(`[sync ${key}] upsert`, e));
        }
      }
    },
    remove(id) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        items.splice(i, 1);
        emit();
        if (sync.remove) sync.remove(id).catch((e) => console.warn(`[sync ${key}] remove`, e));
      }
    },
    replaceAll(next) {
      items.splice(0, items.length, ...next);
      emit();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot: () => snapshot,
    setSync(next) { sync = next; },
  };
}

export function useCollection<T extends WithId>(c: Collection<T>): T[] {
  return useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
}

export const newId = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
