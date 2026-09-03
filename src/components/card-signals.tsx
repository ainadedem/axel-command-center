import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiny icon + value signals used on Kanban cards.
 *
 * Boards keep only two lines per card, so metadata (dates, assignees,
 * comment counts, linked documents) collapses into these icon chips. Each one
 * carries a title and an aria-label so nothing is lost when the text is gone.
 */
export function CardSignal({
  icon: Icon,
  label,
  value,
  tone = "muted",
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  /** Full accessible description, e.g. "Due 12 Sep". */
  label: string;
  /** Short visible text next to the icon. Omit for icon-only signals. */
  value?: ReactNode;
  tone?: "muted" | "danger" | "warning" | "success";
  className?: string;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-0.5 shrink-0 t-micro font-tnum leading-none",
        tone === "muted" && "text-muted-foreground",
        tone === "danger" && "text-destructive",
        tone === "warning" && "text-amber-600 dark:text-amber-400",
        tone === "success" && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {value !== undefined && value !== null && value !== "" && <span>{value}</span>}
    </span>
  );
}

/** Row that holds the signals, right-aligned after the amount. */
export function CardSignalRow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>{children}</span>;
}

/** Initials avatar dot used for assignees. */
export function CardInitial({ name, label }: { name: string; label?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      title={label ?? name}
      aria-label={label ?? name}
      className="inline-grid place-items-center h-4 w-4 shrink-0 rounded-full bg-[var(--surface-container)] text-[8px] font-medium text-muted-foreground"
    >
      {initials || "?"}
    </span>
  );
}
