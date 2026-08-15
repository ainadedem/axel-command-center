import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useWriteStatus } from "@/lib/data-store";
import { cn } from "@/lib/utils";

/**
 * Persistence affordances for financial rows.
 *
 * A money value is never presented as saved before the database confirms it:
 *  - while saving, the figure is dimmed and a quiet dot sits next to the row;
 *  - on acknowledgement the figure flashes (opacity/colour only, no resize);
 *  - on failure the value has already been reverted by the store, and the row
 *    shows a "Not saved" flag with a retry action.
 */

export function RowSaveState({
  collection,
  id,
  className,
}: {
  collection: string;
  id: string;
  className?: string;
}) {
  const status = useWriteStatus(collection, id);
  if (status.state === "idle") return null;

  if (status.state === "error") {
    return (
      <span className={cn("inline-flex items-center gap-1 align-middle text-destructive", className)}>
        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 text-[10px] font-medium uppercase tracking-wider">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          Not saved
        </span>
        {status.retry && (
          <button
            type="button"
            onClick={status.retry}
            title={status.message ?? "Retry saving"}
            aria-label="Retry saving this record"
            className="icon-affordance inline-flex h-5 w-5 items-center justify-center rounded-full text-destructive"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
          </button>
        )}
      </span>
    );
  }

  if (status.state === "saving") {
    return (
      <span
        className={cn("save-dot align-middle", className)}
        role="status"
        aria-label="Saving"
        title="Saving…"
      />
    );
  }

  return <span className={cn("save-dot save-dot-done align-middle", className)} aria-hidden />;
}

/**
 * Wraps a monetary figure: tabular digits, dimmed while pending, brief
 * highlight when the write is acknowledged. Never changes size.
 */
export function LiveAmount({
  collection,
  id,
  children,
  className,
}: {
  collection: string;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const status = useWriteStatus(collection, id);
  return (
    <span
      className={cn(
        "live-amount font-tnum",
        status.state === "saving" && "is-pending",
        status.state === "saved" && "is-confirmed",
        status.state === "error" && "is-failed",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Highlights a plain figure whenever its rendered value changes. */
export function FlashOnChange({ value, className }: { value: ReactNode; className?: string }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);
  return <span className={cn("live-amount font-tnum", flash && "is-confirmed", className)}>{value}</span>;
}
