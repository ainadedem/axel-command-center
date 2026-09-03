import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { useWriteStatus } from "@/lib/data-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dismissEntry, formatJournalValue, useRejection } from "@/lib/write-journal";
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
  const rejection = useRejection(collection, id);
  if (status.state === "idle") return null;

  if (status.state === "error") {
    return (
      <span className={cn("inline-flex items-center gap-1 align-middle text-destructive", className)}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={status.message ?? "This change was not saved"}
              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 t-micro font-medium uppercase tracking-wider transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-destructive/15 active:scale-95"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Not saved
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-3 text-left">
            <p className="t-label font-semibold text-destructive">Rejected by the server</p>
            <p className="mt-1 t-label text-muted-foreground">
              {rejection?.message ?? status.message ?? "The database did not confirm this change."}
            </p>
            {rejection && rejection.fields.length > 0 && (
              <ul className="mt-2 space-y-1">
                {rejection.fields.map((f) => (
                  <li key={f.field} className="t-label">
                    <span className="text-muted-foreground">{f.field}: </span>
                    <span className="font-tnum">{formatJournalValue(f.previous)}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-tnum line-through text-destructive">
                      {formatJournalValue(f.attempted)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 t-label text-muted-foreground">
              The value shown in the table is the last one the database confirmed.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {status.retry && (
                <button
                  type="button"
                  onClick={status.retry}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 t-label font-medium text-primary-foreground transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden /> Retry
                </button>
              )}
              {rejection && (
                <button
                  type="button"
                  onClick={() => dismissEntry(rejection.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 t-label transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95"
                >
                  <X className="h-3 w-3" aria-hidden /> Discard
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
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
