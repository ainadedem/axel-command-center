/**
 * Small self-contained guided tour. Highlights real elements on the page by
 * data attribute and walks through them with a positioned tooltip.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface TourStep {
  /** CSS selector of the element to highlight. Missing elements are skipped. */
  selector: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}

interface Box { top: number; left: number; width: number; height: number }

export function GuidedTour({ steps, open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setIndex(0); }, [open]);

  const step = steps[index];

  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = document.querySelector(step.selector);
      if (!el) { setBox(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const t = window.setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open || !mounted || !step) return null;

  const pad = 8;
  const tooltipTop = box
    ? box.top + box.height + pad + 220 > window.innerHeight
      ? Math.max(12, box.top - pad - 190)
      : box.top + box.height + pad
    : window.innerHeight / 2 - 100;
  const tooltipLeft = box
    ? Math.min(Math.max(12, box.left), Math.max(12, window.innerWidth - 380))
    : window.innerWidth / 2 - 180;

  const last = index === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Guided tour">
      <div className="absolute inset-0 bg-foreground/50 motion-safe:transition-opacity" onClick={onClose} />
      {box && (
        <div
          aria-hidden
          className="absolute rounded-xl ring-2 ring-primary pointer-events-none motion-safe:transition-all motion-safe:duration-300"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            background: "transparent",
          }}
        />
      )}
      <div
        className="absolute w-[360px] max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card p-4 shadow-xl motion-safe:transition-all motion-safe:duration-300"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="t-micro uppercase tracking-wider text-muted-foreground">
            Step {index + 1} of {steps.length}
          </div>
          <button onClick={onClose} aria-label="Close tour" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-1 font-display t-subtitle font-semibold">{step.title}</h3>
        <p className="mt-1 t-body text-muted-foreground leading-relaxed">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Skip</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>Back</Button>
          <Button size="sm" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>{last ? "Done" : "Next"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Remembers tour completion per user so it never nags. */
export function useTourSeen(key: string): [boolean, () => void] {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try { setSeen(window.localStorage.getItem(key) === "1"); } catch { setSeen(true); }
  }, [key]);
  const markSeen = () => {
    setSeen(true);
    try { window.localStorage.setItem(key, "1"); } catch { /* ignore */ }
  };
  return [seen, markSeen];
}
