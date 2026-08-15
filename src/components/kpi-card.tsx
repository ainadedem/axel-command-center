import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

function useCountUp(target: number, enabled: boolean) {
  const [display, setDisplay] = useState(enabled ? 0 : target);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setDisplay(target);
      return;
    }
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const duration = 650;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  return display;
}

function AnimatedNumber({ value }: { value: number }) {
  const shown = useCountUp(value, true);
  const decimals = Number.isInteger(value) ? 0 : 2;
  return <>{shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

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
            : "bg-card";

  return (
    <div className={cn(
      "group relative rounded-2xl border border-border/70 p-5 overflow-hidden shadow-[var(--shadow-card)] hover-lift rise-in",
      toneSurface,
    )}>
      {/* soft cursor-agnostic sheen on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 [background:radial-gradient(120%_80%_at_100%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_60%)]" />
      <div className="relative flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-[11px] tracking-[0.02em] text-muted-foreground font-medium truncate transition-colors duration-300 group-hover:text-foreground/70">{label}</div>
          {badge}
        </div>
        {trend && (
          <div className={cn(
            "text-[11px] flex items-center gap-0.5 font-medium font-tnum shrink-0 rounded-full px-2 py-0.5 transition-transform duration-300 group-hover:-translate-y-px",
            trendDir === "up" && "text-success bg-success/10",
            trendDir === "down" && "text-destructive bg-destructive/10",
            trendDir === "flat" && "text-muted-foreground bg-muted",
          )}>
            {trendDir === "up" && <ArrowUpRight className="h-3 w-3" />}
            {trendDir === "down" && <ArrowDownRight className="h-3 w-3" />}
            {trend}
          </div>
        )}
      </div>
      <div className={cn(
        "relative font-display text-metric",
        tone === "danger" && "text-destructive",
        tone === "warning" && "text-amber-500",
      )}>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : <FlashOnChange value={value} />}
      </div>
      {sub && <div className="relative text-xs text-muted-foreground mt-2 font-tnum">{sub}</div>}
      {children}
    </div>
  );
}
