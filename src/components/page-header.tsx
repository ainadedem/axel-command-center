import { useCompany } from "@/lib/company-context";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { label } = useCompany();
  return (
    <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6 border-b border-border/60">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2 truncate">{label}</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight break-words">{title}</h1>
        {description && <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
