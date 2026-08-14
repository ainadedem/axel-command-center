// Global undo/redo history (depth 5) for data-store mutations.
import { useSyncExternalStore } from "react";

export interface HistoryEntry {
  label: string;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

const MAX_DEPTH = 5;

let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];
let suspended = 0;

const listeners = new Set<() => void>();

export interface HistorySnapshot {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

let snapshot: HistorySnapshot = { canUndo: false, canRedo: false, undoLabel: null, redoLabel: null };

function emit() {
  snapshot = {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack[undoStack.length - 1]?.label ?? null,
    redoLabel: redoStack[redoStack.length - 1]?.label ?? null,
  };
  listeners.forEach((l) => l());
}

export const historyIsSuspended = () => suspended > 0;

/** Run `fn` without recording any history entries (used by undo/redo itself). */
export async function withoutHistory<T>(fn: () => T | Promise<T>): Promise<T> {
  suspended += 1;
  try {
    return await fn();
  } finally {
    suspended -= 1;
  }
}

export function pushHistory(entry: HistoryEntry) {
  if (suspended > 0) return;
  undoStack.push(entry);
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  redoStack = [];
  emit();
}

export async function undo(): Promise<string | null> {
  const entry = undoStack.pop();
  if (!entry) return null;
  emit();
  try {
    await withoutHistory(() => entry.undo());
  } catch (e) {
    undoStack.push(entry);
    emit();
    throw e;
  }
  redoStack.push(entry);
  if (redoStack.length > MAX_DEPTH) redoStack.shift();
  emit();
  return entry.label;
}

export async function redo(): Promise<string | null> {
  const entry = redoStack.pop();
  if (!entry) return null;
  emit();
  try {
    await withoutHistory(() => entry.redo());
  } catch (e) {
    redoStack.push(entry);
    emit();
    throw e;
  }
  undoStack.push(entry);
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  emit();
  return entry.label;
}

export function clearHistory() {
  undoStack = [];
  redoStack = [];
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => snapshot;

export function useHistory(): HistorySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
