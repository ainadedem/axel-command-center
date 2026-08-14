import { ArrowUpRight, CalendarClock, Inbox } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AGING_TONE_DOT, AGING_TONE_TEXT, daysLate, type AgingBucketDef } from "@/lib/aging";
import { cn } from "@/lib/utils";

/** Shimmering placeholder matching the real record card geometry. */
function DrawerSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded skeleton-shimmer" />
              <div className="h-2.5 w-24 rounded skeleton-shimmer" />
            </div>
            <div className="h-3.5 w-20 rounded skeleton-shimmer" />
          </div>
          <div className="mt-2.5 h-2.5 w-28 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/** Designed empty state for a bucket with no records. */
function DrawerEmpty({ noun }: { noun: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-container)]">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="font-display text-sm font-semibold">Nothing in this bucket</div>
      <p className="mt-1 text-xs text-muted-foreground">
        No {noun}s currently fall in this aging window with the filters you have applied.
      </p>
    </div>
  );
}


/** One record shown inside the aging drawer. */
export interface AgingDrawerItem {
  id: string;
  /** Document number, e.g. "INV-2026-014". */
  title: string;
  /** Client / supplier line. */
  subtitle?: string;
  /** Outstanding balance already converted to the display currency. */
  amount: number;
  /** ISO due date. */
  due?: string;
  status?: string;
}

/**
 * Slide-over listing the exact records behind an aging bucket, with a
 * "jump to record" affordance per row.
 */
export function AgingDrawer({
  open,
  onOpenChange,
  bucket,
  items,
  format,
  noun,
  onJump,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: AgingBucketDef | null;
  items: AgingDrawerItem[];
  format: (v: number) => string;
  noun: string;
  onJump: (item: AgingDrawerItem) => void;
  /** Records are still resolving — show skeleton cards. */
  loading?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  const tone = bucket?.tone ?? "neutral";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="p-5 border-b border-border space-y-1 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className={cn("h-2 w-2 rounded-full", AGING_TONE_DOT[tone])} aria-hidden="true" />
            {bucket?.label ?? "Aging"}
          </SheetTitle>
          <SheetDescription>
            {loading ? (
              <span className="inline-block h-3 w-40 align-middle rounded skeleton-shimmer" />
            ) : (
              <>
                {items.length} {noun}
                {items.length !== 1 ? "s" : ""} ·{" "}
                <span className={AGING_TONE_TEXT[tone]}>{format(total)}</span> outstanding
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5" aria-busy={loading || undefined}>
          {loading ? (
            <DrawerSkeleton />
          ) : items.length === 0 ? (
            <DrawerEmpty noun={noun} />
          ) : (

            items.map((item) => {
              const late = daysLate(item.due);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onJump(item)}
                  className={cn(
                    "group w-full text-left rounded-xl border border-border bg-card px-3.5 py-3",
                    "transition-[background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                    "hover:bg-surface-elevated hover:shadow-sm active:scale-[0.995]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {item.title}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:opacity-100 group-hover:translate-x-0" aria-hidden="true" />
                      </div>
                      {item.subtitle && <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-tnum text-sm font-semibold">{format(item.amount)}</div>
                      {item.status && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.status}</div>}
                    </div>
                  </div>
                  {item.due && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      Due {item.due}
                      {late > 0 && <span className={cn("font-medium", AGING_TONE_TEXT[tone])}>· {late} d late</span>}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
