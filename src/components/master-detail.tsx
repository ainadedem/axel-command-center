import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Two-panel master/detail shell.
 *
 * The list (children) keeps the full width of the canvas until a record is
 * selected; the focused work panel then floats on the right on large screens
 * and slides up as a sheet on small ones.
 */
export function MasterDetail({
  children,
  detail,
  className,
}: {
  children: ReactNode;
  /** Rendered when a record is selected. Pass `null` to collapse the panel. */
  detail?: ReactNode | null;
  className?: string;
}) {
  const open = Boolean(detail);
  return (
    <div className={cn("flex items-start gap-5", className)}>
      <div className="min-w-0 flex-1">{children}</div>

      {open && (
        <>
          {/* Desktop: sticky side panel */}
          <aside
            aria-label="Selected record"
            className="hidden lg:block w-[20rem] xl:w-[22rem] shrink-0 sticky top-3 max-h-[calc(100dvh-5rem)] overflow-y-auto rise-in"
          >
            {detail}
          </aside>

          {/* Mobile: bottom sheet */}
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto p-3">
            <div className="rise-in">{detail}</div>
          </div>
        </>
      )}
    </div>
  );
}

/** The focused work panel itself. */
export function DetailPanel({
  title,
  subtitle,
  eyebrow,
  onClose,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  onClose: () => void;
  /** Primary actions for the selected record. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="panel p-4 space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[11px] tracking-[0.06em] text-muted-foreground mb-1 truncate">{eyebrow}</div>
          )}
          <h2 className="font-display text-lg font-semibold tracking-tight break-words">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 break-words">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {children}

      {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
    </div>
  );
}

/** A label / value line inside the panel. */
export function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  /** Numbers align on tabular figures. */
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-2 py-1 text-xs">
      <div className="text-muted-foreground truncate">{label}</div>
      <div className={cn("min-w-0 break-words", mono && "font-tnum")}>{value ?? "—"}</div>
    </div>
  );
}

/** Groups fields with a soft divider between blocks. */
export function DetailSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-[var(--surface-container)]/60 px-3 py-2">
      {title && (
        <h3 className="text-[11px] tracking-[0.06em] text-muted-foreground mb-1">{title}</h3>
      )}
      {children}
    </section>
  );
}
