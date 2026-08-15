// Lightweight reactive in-memory store with localStorage persistence.
// Each collection mutates an exported array IN PLACE so non-subscribing
// readers also see fresh data on next render.
//
// Write risk tiers (finance app):
//  - normal collections stay fully optimistic (UI state, reference data);
//  - collections created with `{ critical: true }` hold money. Their rows are
//    marked "saving" until the database acknowledges, flash "saved" on ack, and
//    REVERT + flag "error" when the write fails. A financial figure is never
//    left on screen as if it were persisted.
import { useSyncExternalStore } from "react";
import { pushHistory } from "./history";
import { recordAttempt, type JournalField, type JournalHandle } from "./write-journal";


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

/* ------------------------------------------------------------------ */
/* Write status registry                                               */
/* ------------------------------------------------------------------ */

export type WriteState = "idle" | "saving" | "saved" | "error";

export interface WriteStatus {
  state: WriteState;
  message?: string;
  /** Re-run the failed write. */
  retry?: () => void;
}

const IDLE: WriteStatus = { state: "idle" };

const statusMap = new Map<string, WriteStatus>();
const statusListeners = new Set<() => void>();
const savedTimers = new Map<string, ReturnType<typeof setTimeout>>();

const statusKey = (collectionKey: string, id: string) => `${collectionKey}:${id}`;

function emitStatus() {
  statusListeners.forEach((l) => l());
}

function setStatus(collectionKey: string, id: string, status: WriteStatus | null) {
  const k = statusKey(collectionKey, id);
  const timer = savedTimers.get(k);
  if (timer) {
    clearTimeout(timer);
    savedTimers.delete(k);
  }
  if (!status || status.state === "idle") statusMap.delete(k);
  else statusMap.set(k, status);
  emitStatus();

  if (status?.state === "saved") {
    // Brief confirmation flash, then back to idle.
    savedTimers.set(
      k,
      setTimeout(() => {
        savedTimers.delete(k);
        statusMap.delete(k);
        emitStatus();
      }, 1200),
    );
  }
}

function moveStatus(collectionKey: string, fromId: string, toId: string) {
  if (fromId === toId) return;
  const cur = statusMap.get(statusKey(collectionKey, fromId));
  statusMap.delete(statusKey(collectionKey, fromId));
  if (cur) statusMap.set(statusKey(collectionKey, toId), cur);
  emitStatus();
}

function subscribeStatus(cb: () => void) {
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

function getStatus(collectionKey: string, id: string): WriteStatus {
  return statusMap.get(statusKey(collectionKey, id)) ?? IDLE;
}

/** Subscribe to the persistence state of one record. */
export function useWriteStatus(collectionKey: string, id: string | undefined): WriteStatus {
  return useSyncExternalStore(
    subscribeStatus,
    () => (id ? getStatus(collectionKey, id) : IDLE),
    () => IDLE,
  );
}

/** True when any record of these collections is still saving. */
export function useAnyPending(collectionKeys: string[]): boolean {
  return useSyncExternalStore(
    subscribeStatus,
    () => {
      for (const [k, v] of statusMap) {
        if (v.state === "saving" && collectionKeys.some((c) => k.startsWith(`${c}:`))) return true;
      }
      return false;
    },
    () => false,
  );
}

export type WriteFailureListener = (info: { collection: string; id: string; message: string }) => void;

const failureListeners = new Set<WriteFailureListener>();

/** Global hook so the shell can surface a toast on any rejected financial write. */
export function onWriteFailure(cb: WriteFailureListener) {
  failureListeners.add(cb);
  return () => failureListeners.delete(cb);
}

function reportFailure(collection: string, id: string, message: string) {
  failureListeners.forEach((l) => l({ collection, id, message }));
}

const errText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Could not reach the database";

/* ------------------------------------------------------------------ */

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
  /** Storage/status key of this collection. */
  key: string;
  /** Holds financial records — writes are confirmed, not assumed. */
  critical: boolean;
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

export function createCollection<T extends WithId>(
  key: string,
  initial: T[],
  opts?: { critical?: boolean },
): Collection<T> {
  const hydrated = load<T>(key, initial);
  const items: T[] = [...hydrated];
  const listeners = new Set<() => void>();
  let snapshot: T[] = [...items];
  let sync: CollectionSync<T> = {};
  const noun = humanize(key);
  const critical = opts?.critical ?? false;

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
    moveStatus(key, localId, dbId);
  };

  const collection: Collection<T> = {
    items,
    key,
    critical,
    add(item, opts) {
      items.push(item);
      emit();
      let currentId = item.id;
      if (sync.upsert) {
        if (critical) setStatus(key, item.id, { state: "saving" });
        const attempt = () => {
          if (critical) setStatus(key, currentId, { state: "saving" });
          const journal: JournalHandle | null = critical
            ? recordAttempt({
                collection: key,
                noun,
                recordId: currentId,
                kind: "create",
                fields: [],
              })
            : null;
          sync
            .upsert!(item)
            .then((dbId) => {
              if (dbId) {
                swapId(currentId, dbId);
                currentId = dbId;
                journal?.rebind(dbId);
              }
              if (critical) setStatus(key, currentId, { state: "saved" });
              journal?.confirm();
              opts?.onSynced?.(dbId ?? currentId);
            })
            .catch((e) => {
              console.warn(`[sync ${key}] upsert`, e);
              if (!critical) return;
              const message = errText(e);
              setStatus(key, currentId, { state: "error", message, retry: attempt });
              journal?.reject(message, attempt);
              reportFailure(noun, currentId, message);
            });
        };
        attempt();
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
          const attempt = () => {
            const idx = items.findIndex((x) => x.id === id);
            if (idx < 0) return;
            // Re-apply the intended patch in case a failure reverted it.
            items[idx] = { ...items[idx], ...patch };
            emit();
            if (critical) setStatus(key, id, { state: "saving" });
            sync
              .upsert!(items[idx])
              .then(() => {
                if (critical) setStatus(key, id, { state: "saved" });
              })
              .catch((e) => {
                console.warn(`[sync ${key}] upsert`, e);
                if (!critical) return;
                // Revert to the last database-confirmed values.
                const j = items.findIndex((x) => x.id === id);
                if (j >= 0) {
                  items[j] = { ...items[j], ...previous };
                  emit();
                }
                const message = errText(e);
                setStatus(key, id, { state: "error", message, retry: attempt });
                reportFailure(noun, id, message);
              });
          };
          attempt();
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
        const position = i;
        items.splice(i, 1);
        emit();
        if (sync.remove) {
          sync.remove(id).catch((e) => {
            console.warn(`[sync ${key}] remove`, e);
            if (!critical) return;
            // Put the row back — it still exists in the database.
            if (!items.some((x) => x.id === id)) {
              items.splice(Math.min(position, items.length), 0, removed);
              emit();
            }
            const message = errText(e);
            setStatus(key, id, {
              state: "error",
              message,
              retry: () => collection.remove(id, { silent: true }),
            });
            reportFailure(noun, id, message);
          });
        }
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
