import type { ReactNode } from "react";
import { Plus, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shell used by modules that are scaffolded but not wired to data yet:
 * a placeholder table with the future columns plus a quiet empty state.
 */
export function PlaceholderTable({
  title,
  count,
  columns,
  emptyTitle = "No records yet",
  emptyDescription,
  addLabel,
  children,
}: {
  title: string;
  count?: string;
  columns: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  addLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-display t-title font-semibold truncate">{title}</div>
        </div>
        <div className="flex items-center gap-3">
          {count && <div className="t-label text-muted-foreground">{count}</div>}
          <Button size="sm" disabled className="gap-1.5">
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="sheet w-full min-w-[720px] t-body">
          <thead>
            <tr className="t-label uppercase tracking-wider text-muted-foreground border-b border-border">
              {columns.map((c) => (
                <th key={c} className="text-left font-medium px-5 py-2">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      {children ?? (
        <div className="px-8 py-16 text-center">
          <div
            className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"
            aria-hidden
          >
            <Inbox className="h-5 w-5" />
          </div>
          <h2 className="t-body font-semibold text-foreground">{emptyTitle}</h2>
          {emptyDescription && (
            <p className="mx-auto mt-1.5 max-w-md t-label leading-relaxed text-muted-foreground">
              {emptyDescription}
            </p>
          )}
          <div className="mt-5 flex justify-center">
            <Button size="sm" disabled className="gap-1.5">
              <Plus className="h-4 w-4" /> {addLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
