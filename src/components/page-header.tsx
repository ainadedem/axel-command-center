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
    <div className="px-8 pt-8 pb-6 flex items-end justify-between gap-6 border-b border-border/60">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{label}</div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
