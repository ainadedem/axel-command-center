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
    <div className="px-5 sm:px-10 lg:px-12 pt-8 sm:pt-12 pb-5 sm:pb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-8">
      <div className="min-w-0">
        <div className="t-label tracking-[0.06em] text-muted-foreground mb-2 truncate">{label}</div>
        <h1 className="font-display text-[1.6rem] sm:text-[2rem] font-medium tracking-[-0.01em] leading-tight break-words">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 t-body leading-relaxed max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  );
}
