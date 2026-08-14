/**
 * Deep-link helper: pages accept `?focus=<record id>` so other screens (the SOP
 * compliance checklist, alerts, …) can point straight at the offending record.
 *
 * A page opts in by (1) declaring `validateSearch: focusSearch`, (2) calling
 * `useFocusRow(search.focus)`, and (3) tagging each row with
 * `data-focus-id={record.id}`.
 */
import { useEffect } from "react";

export interface FocusSearch {
  focus?: string;
}

export const focusSearch = (search: Record<string, unknown>): FocusSearch => ({
  focus: typeof search.focus === "string" && search.focus ? search.focus : undefined,
});

const RING = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-lg"];

/**
 * Imperative version of {@link useFocusRow}: scroll a row into view and pulse
 * its ring. Returns a cleanup that removes the ring early.
 */
export function focusRowById(id: string): () => void {
  if (typeof document === "undefined") return () => {};
  let cancelled = false;
  let cleanup: (() => void) | undefined;
  const start = Date.now();
  const tick = () => {
    if (cancelled) return;
    const el = document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
    if (!el) {
      if (Date.now() - start < 4000) window.setTimeout(tick, 200);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(...RING);
    const t = window.setTimeout(() => el.classList.remove(...RING), 2600);
    cleanup = () => {
      window.clearTimeout(t);
      el.classList.remove(...RING);
    };
  };
  tick();
  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export function useFocusRow(id?: string) {
  useEffect(() => {
    if (!id || typeof document === "undefined") return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // The list may still be hydrating — retry briefly before giving up.
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
      if (!el) {
        if (Date.now() - start < 6000) window.setTimeout(tick, 250);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add(...RING);
      const t = window.setTimeout(() => el.classList.remove(...RING), 2600);
      cleanup = () => {
        window.clearTimeout(t);
        el.classList.remove(...RING);
      };
    };
    tick();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [id]);
}
