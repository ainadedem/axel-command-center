// Lightweight reactive in-memory store with localStorage persistence.
// Each collection mutates an exported array IN PLACE so non-subscribing
// readers also see fresh data on next render.
import { useSyncExternalStore } from "react";
import { pushHistory } from "./history";


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

export interface MutationOptions {
  /** Skip recording an undo/redo history entry (hydration, programmatic sync). */
  silent?: boolean;
}

export interface Collection<T extends WithId> {
  items: T[];
  /** `onSynced` receives the canonical (DB) id once the remote insert resolves. */
  add: (item: T, opts?: { onSynced?: (id: string) => void } & MutationOptions) => void;
  update: (id: string, patch: Partial<T>, opts?: MutationOptions) => void;
  remove: (id: string, opts?: MutationOptions) => void;
  replaceAll: (next: T[]) => void;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => T[];
  /** Register sync hooks (called after each mutation, fire-and-forget). */
  setSync: (sync: CollectionSync<T>) => void;
}

const humanize = (key: string) => key.replace(/-/g, " ").replace(/s$/, "");

export function createCollection<T extends WithId>(key: string, initial: T[]): Collection<T> {
  const hydrated = load<T>(key, initial);
  const items: T[] = [...hydrated];
  const listeners = new Set<() => void>();
  let snapshot: T[] = [...items];
  let sync: CollectionSync<T> = {};
  const noun = humanize(key);

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

  const collection: Collection<T> = {
    items,
    add(item, opts) {
      items.push(item);
      emit();
      let currentId = item.id;
      if (sync.upsert) {
        sync.upsert(item).then((dbId) => {
          if (dbId) { swapId(item.id, dbId); currentId = dbId; }
          opts?.onSynced?.(dbId ?? item.id);
        }).catch((e) => console.warn(`[sync ${key}] upsert`, e));
      } else {
        opts?.onSynced?.(item.id);
      }
      if (!opts?.silent) {
        pushHistory({
          label: `create ${noun}`,
          undo: () => { collection.remove(currentId); },
          redo: () => {
            const restored = { ...item, id: currentId } as T;
            collection.add(restored, { onSynced: (id) => { currentId = id; } });
          },
        });
      }
    },

    update(id, patch, opts) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        const before = items[i];
        const previous: Partial<T> = {};
        (Object.keys(patch) as (keyof T)[]).forEach((k) => { previous[k] = before[k]; });
        items[i] = { ...before, ...patch };
        emit();
        if (sync.upsert) {
          const snap = items[i];
          sync.upsert(snap).catch((e) => console.warn(`[sync ${key}] upsert`, e));
        }
        if (!opts?.silent) {
          pushHistory({
            label: `edit ${noun}`,
            undo: () => { collection.update(id, previous); },
            redo: () => { collection.update(id, patch); },
          });
        }
      }
    },
    remove(id, opts) {
      const i = items.findIndex((x) => x.id === id);
      if (i >= 0) {
        const removed = items[i];
        items.splice(i, 1);
        emit();
        if (sync.remove) sync.remove(id).catch((e) => console.warn(`[sync ${key}] remove`, e));
        if (!opts?.silent) {
          let currentId = id;
          pushHistory({
            label: `delete ${noun}`,
            undo: () => {
              collection.add({ ...removed, id: currentId } as T, { onSynced: (newId) => { currentId = newId; } });
            },
            redo: () => { collection.remove(currentId); },
          });
        }
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

  return collection;
}


export function useCollection<T extends WithId>(c: Collection<T>): T[] {
  return useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot);
}

export const newId = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
