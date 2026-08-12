import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Standard content panel: consistent radius, padding, elevation and header. */
export function PanelCard({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-titlecard">{title}</h2>}
            {description && <p className="text-caption text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("px-5 pb-5", !title && "pt-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small status pill using semantic tokens only. */
export function StatPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "positive" | "negative" | "warning" | "info";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-secondary text-secondary-foreground border-border",
    positive: "bg-success/10 text-success border-success/25",
    negative: "bg-destructive/10 text-destructive border-destructive/25",
    warning: "bg-warning/15 text-warning-foreground border-warning/30",
    info: "bg-accent text-accent-foreground border-primary/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Consistent empty state. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-12 text-center", className)}>
      {Icon && (
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 text-caption text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
