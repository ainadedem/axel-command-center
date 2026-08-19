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
    <div className="px-5 sm:px-10 pt-6 sm:pt-8 pb-4 sm:pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6">
      <div className="min-w-0">
        <div className="text-[11px] tracking-[0.06em] text-muted-foreground mb-1.5 truncate">{label}</div>
        <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold tracking-tight leading-tight break-words">{title}</h1>
        {description && <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
