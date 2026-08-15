// Session-scoped audit trail of financial writes.
//
// Every critical write records what was on screen before, what was attempted,
// and what the database eventually said. Nothing here is ever presented as
// "saved" before the server confirms it: entries start `pending` and only move
// to `confirmed` or `rejected`.
import { useSyncExternalStore } from "react";

export type JournalState = "pending" | "confirmed" | "rejected";

export interface JournalField {
  field: string;
  previous: unknown;
  attempted: unknown;
}

export interface JournalEntry {
  id: string;
  collection: string;
  /** Human label for the collection ("invoice", "transaction"…). */
  noun: string;
  recordId: string;
  kind: "create" | "update" | "delete";
  fields: JournalField[];
  state: JournalState;
  message?: string;
  at: number;
  retry?: () => void;
}

const MAX_ENTRIES = 60;

let entries: JournalEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  entries = [...entries];
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let seq = 0;

export interface JournalHandle {
  /** The write reached the database. */
  confirm: () => void;
  /** The database rejected the write; the store has reverted the value. */
  reject: (message: string, retry?: () => void) => void;
  /** Follow the record when the database hands back a canonical id. */
  rebind: (recordId: string) => void;
}

export function recordAttempt(input: {
  collection: string;
  noun: string;
  recordId: string;
  kind: JournalEntry["kind"];
  fields: JournalField[];
}): JournalHandle {
  const id = `w${++seq}`;
  entries = [{ ...input, id, state: "pending", at: Date.now() }, ...entries].slice(0, MAX_ENTRIES);
  emit();

  const patch = (next: Partial<JournalEntry>) => {
    const i = entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    entries[i] = { ...entries[i], ...next };
    emit();
  };

  return {
    confirm: () => patch({ state: "confirmed", at: Date.now(), retry: undefined }),
    reject: (message, retry) => patch({ state: "rejected", message, at: Date.now(), retry }),
    rebind: (recordId) => patch({ recordId }),
  };
}

export function getJournal(): JournalEntry[] {
  return entries;
}

/** Latest rejected write for a record, if any. */
export function getRejection(collection: string, recordId: string): JournalEntry | undefined {
  return entries.find(
    (e) => e.state === "rejected" && e.collection === collection && e.recordId === recordId,
  );
}

export function dismissEntry(id: string) {
  entries = entries.filter((e) => e.id !== id);
  emit();
}

export function clearResolved() {
  entries = entries.filter((e) => e.state === "rejected");
  emit();
}

const EMPTY: JournalEntry[] = [];

export function useWriteJournal(): JournalEntry[] {
  return useSyncExternalStore(subscribe, getJournal, () => EMPTY);
}

export function useRejection(collection: string, recordId: string | undefined) {
  return useSyncExternalStore(
    subscribe,
    () => (recordId ? getRejection(collection, recordId) : undefined),
    () => undefined,
  );
}

export function useUnresolvedCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => entries.filter((e) => e.state === "rejected").length,
    () => 0,
  );
}

/** Presentational helper — journal values are unknown by design. */
export function formatJournalValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return new Intl.NumberFormat("en-US").format(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : v;
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  } catch {
    return String(v);
  }
}
