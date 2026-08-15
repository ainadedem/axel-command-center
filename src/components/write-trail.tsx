import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  clearResolved,
  dismissEntry,
  formatJournalValue,
  useUnresolvedCount,
  useWriteJournal,
  type JournalEntry,
} from "@/lib/write-journal";
import { cn } from "@/lib/utils";

/**
 * "Recent write issues" — the honest trail of what the database accepted and
 * what it refused. Rejected writes list the previously confirmed value next to
 * the attempted one, so nothing ever reads as saved when it is not.
 */

const stateMeta: Record<JournalEntry["state"], { icon: typeof CheckCircle2; tone: string; label: string }> = {
  pending: { icon: Loader2, tone: "text-muted-foreground", label: "Saving" },
  confirmed: { icon: CheckCircle2, tone: "text-success", label: "Confirmed by server" },
  rejected: { icon: AlertTriangle, tone: "text-destructive", label: "Rejected by server" },
};

const timeOf = (ts: number) =>
  new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function WriteTrailButton({ onJump }: { onJump?: (entry: JournalEntry) => void }) {
  const entries = useWriteJournal();
  const unresolved = useUnresolvedCount();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label={unresolved > 0 ? `${unresolved} unsaved changes` : "Recent save activity"}
          title={unresolved > 0 ? `${unresolved} change${unresolved === 1 ? "" : "s"} were not saved` : "Recent save activity"}
          className={cn(
            "relative h-9 w-9 grid place-items-center rounded-full focus-ring tap-target transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[var(--surface-container)] active:scale-95",
            unresolved > 0 ? "text-destructive" : "text-foreground/70",
          )}
        >
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          {unresolved > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground font-tnum">
              {unresolved}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Save activity</SheetTitle>
          <SheetDescription>
            Every financial write in this session, with the value the database confirmed.
          </SheetDescription>
        </SheetHeader>

        {entries.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">
            No financial writes yet in this session.
          </p>
        ) : (
          <>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={clearResolved}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Clear confirmed
              </button>
            </div>
            <ul className="mt-2 space-y-2">
              {entries.map((e) => {
                const meta = stateMeta[e.state];
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        className={cn("h-4 w-4 mt-0.5 shrink-0", meta.tone, e.state === "pending" && "animate-spin")}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">
                          {e.kind} {e.noun}
                        </p>
                        <p className={cn("text-xs", meta.tone)}>
                          {meta.label} · <span className="font-tnum">{timeOf(e.at)}</span>
                        </p>
                        {e.message && <p className="mt-1 text-xs text-muted-foreground">{e.message}</p>}
                        {e.fields.length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {e.fields.map((f) => (
                              <li key={f.field} className="text-xs">
                                <span className="text-muted-foreground">{f.field}: </span>
                                <span className="font-tnum">{formatJournalValue(f.previous)}</span>
                                <span className="text-muted-foreground"> → </span>
                                <span
                                  className={cn(
                                    "font-tnum",
                                    e.state === "rejected" ? "line-through text-destructive" : "text-success",
                                  )}
                                >
                                  {formatJournalValue(f.attempted)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {e.state === "rejected" && (
                          <div className="mt-2 flex items-center gap-2">
                            {e.retry && (
                              <button
                                type="button"
                                onClick={e.retry}
                                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95"
                              >
                                <RotateCcw className="h-3 w-3" aria-hidden /> Retry
                              </button>
                            )}
                            {onJump && (
                              <button
                                type="button"
                                onClick={() => onJump(e)}
                                className="rounded-full border border-border px-2.5 py-1 text-xs transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95"
                              >
                                Go to record
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => dismissEntry(e.id)}
                              aria-label="Dismiss"
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs transition-transform duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95"
                            >
                              <X className="h-3 w-3" aria-hidden /> Discard
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
