import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  trend,
  trendDir = "up",
  highlight = false,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: string;
  trendDir?: "up" | "down" | "flat";
  highlight?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={cn(
      "relative rounded-xl border border-border p-5 overflow-hidden",
      highlight
        ? "bg-gradient-to-br from-surface-elevated to-surface shadow-[var(--shadow-glow)]"
        : "bg-[var(--gradient-surface)]",
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-medium">{label}</div>
        {trend && (
          <div className={cn(
            "text-xs flex items-center gap-0.5 font-medium font-tnum",
            trendDir === "up" && "text-success",
            trendDir === "down" && "text-destructive",
            trendDir === "flat" && "text-muted-foreground",
          )}>
            {trendDir === "up" && <ArrowUpRight className="h-3 w-3" />}
            {trendDir === "down" && <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </div>
        )}
      </div>
      <div className="font-display text-[28px] leading-none font-bold tracking-tight font-tnum">
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2 font-tnum">{sub}</div>}
      {children}
    </div>
  );
}
