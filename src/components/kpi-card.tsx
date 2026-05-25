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
  tone = "default",
  badge,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: string;
  trendDir?: "up" | "down" | "flat";
  highlight?: boolean;
  /** Override card surface for status semantics (overrides `highlight`). */
  tone?: "default" | "warning" | "danger" | "success";
  /** Optional status pill rendered next to the label (e.g. Warning Zone). */
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const toneSurface =
    tone === "danger"
      ? "bg-destructive/10 border-destructive/40 shadow-[0_0_0_1px_var(--destructive)/0.15]"
      : tone === "warning"
        ? "bg-amber-500/10 border-amber-500/40"
        : tone === "success"
          ? "bg-success/10 border-success/40"
          : highlight
            ? "bg-gradient-to-br from-surface-elevated to-surface shadow-[var(--shadow-glow)]"
            : "bg-[var(--gradient-surface)]";

  return (
    <div className={cn(
      "relative rounded-xl border p-5 overflow-hidden",
      toneSurface,
    )}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-medium truncate">{label}</div>
          {badge}
        </div>
        {trend && (
          <div className={cn(
            "text-xs flex items-center gap-0.5 font-medium font-tnum shrink-0",
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
      <div className={cn(
        "font-display text-[28px] leading-none font-bold tracking-tight font-tnum",
        tone === "danger" && "text-destructive",
        tone === "warning" && "text-amber-500",
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-2 font-tnum">{sub}</div>}
      {children}
    </div>
  );
}

