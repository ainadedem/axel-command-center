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

export interface Collection<T extends WithId> {
  /** Live array reference. Mutated in place on changes. */
  items: T[];
  add: (item: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  replaceAll: (next: T[]) => void;
  subscribe: (cb: () => void) => () => void;
  /** Snapshot getter — required by useSyncExternalStore. */
  getSnapshot: () => T[];
}

export function createCollection<T extends WithId>(key: string, initial: T[]): Collection<T> {
  const hydrated = load<T>(key, initial);
  // Use the hydrated array as the live `items` reference.
  const items: T[] = [...hydrated];
  const listeners = new Set<() => void>();
  let snapshot: T[] = [...items];

  const emit = () => {
    snapshot = [...items];
    save(key, items);
    listeners.forEach((l) => l());
  };

  return {
    items,
    add(item) {
      items.push(item);
      emit();
    },
    update(id, patch) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        items[i] = { ...items[i], ...patch };
        emit();
      }
    },
    remove(id) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        items.splice(i, 1);
        emit();
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
  };
}

export function useCollection<T extends WithId>(c: Collection<T>): T[] {
  return useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
}

export const newId = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
