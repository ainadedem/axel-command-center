import type { ReactNode } from "react";
import { Plus, Inbox, SearchX, CloudOff, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared premium list states: nothing created yet, nothing matched the
 * current filters, or the workspace failed to load.
 */
function Frame({
  icon,
  title,
  description,
  children,
  tone = "default",
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel px-8 py-16 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}
        aria-hidden
      >
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Nothing has been created yet in this workspace. */
export function ListEmptyState({
  label,
  onCreate,
  createLabel,
  description,
}: {
  label: string;
  onCreate: () => void;
  createLabel?: string;
  description?: string;
}) {
  const singular = label.replace(/s$/, "");
  return (
    <Frame
      icon={<Inbox className="h-5 w-5" />}
      title={`No ${label} yet`}
      description={description ?? `Create your first ${singular} — it will show up here with its status, ageing and actions.`}
    >
      <Button size="sm" onClick={onCreate} className="btn-new gap-1.5">
        <Plus className="h-4 w-4" /> {createLabel ?? `Create your first ${singular}`}
      </Button>
    </Frame>
  );
}

export type ActiveFilterChip = { key: string; label: string; onRemove: () => void };

/** Records exist, but the current filters matched none of them. */
export function ListNoMatchState({
  label,
  chips = [],
  onClearAll,
  onCreate,
  createLabel,
}: {
  label: string;
  chips?: ActiveFilterChip[];
  onClearAll: () => void;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <Frame
      icon={<SearchX className="h-5 w-5" />}
      title={`No ${label} match these filters`}
      description="Try removing a filter below, widening the date range, or clearing everything to see the full list."
    >
      {chips.length > 0 && (
        <div className="flex w-full flex-wrap items-center justify-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1 h-7 pl-2.5 pr-2 rounded-full border border-border bg-surface text-[11px] text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
            >
              {c.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={onClearAll} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Clear all filters
        </Button>
        {onCreate && (
          <Button size="sm" variant="outline" onClick={onCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> {createLabel ?? "New"}
          </Button>
        )}
      </div>
    </Frame>
  );
}

/** Loading the workspace data failed. */
export function ListErrorState({
  label,
  message,
  onRetry,
}: {
  label: string;
  message?: string | null;
  onRetry: () => void;
}) {
  return (
    <Frame
      tone="danger"
      icon={<CloudOff className="h-5 w-5" />}
      title={`Couldn't load ${label}`}
      description={
        <>
          Something went wrong while reaching your workspace data. Your filters are kept — try again in a moment.
          {message && <span className="mt-1 block text-[11px] text-muted-foreground/70">{message}</span>}
        </>
      }
    >
      <Button size="sm" onClick={onRetry} className="gap-1.5">
        <RotateCcw className="h-3.5 w-3.5" /> Try again
      </Button>
    </Frame>
  );
}
