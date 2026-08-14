import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Shared chart tokens — every graph in the app pulls from here.
 * ------------------------------------------------------------------ */

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

/** Semantic aliases so meaning stays consistent across pages. */
export const CHART_SEMANTIC = {
  income: "var(--chart-income)",
  expense: "var(--chart-expense)",
  forecast: "var(--chart-forecast)",
  neutral: "var(--chart-neutral)",
  primary: "var(--chart-1)",
} as const;

/** Consistent grid density: horizontal-only, dashed, low contrast. */
export const chartGridProps = {
  stroke: "var(--chart-grid)",
  strokeDasharray: "2 6",
  vertical: false,
} as const;

export const chartAxisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  fontFamily: "var(--font-sans)",
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontFamily: "var(--font-sans)" },
} as const;



export const chartMargin = { top: 8, right: 12, left: -12, bottom: 0 } as const;

/** Corner radius shared by every bar series (top-rounded columns). */
export const CHART_BAR_RADIUS = 8;

/** Spread on every <Bar> so bars look identical across pages. */
export const chartBarProps = {
  radius: [CHART_BAR_RADIUS, CHART_BAR_RADIUS, 0, 0] as [number, number, number, number],
  maxBarSize: 44,
} as const;

/** Bottom segment of a stacked column — rounds the base instead of the top. */
export const chartBarStackBaseProps = {
  radius: [0, 0, CHART_BAR_RADIUS, CHART_BAR_RADIUS] as [number, number, number, number],
  maxBarSize: 44,
} as const;

export const chartCursor = {
  fill: "color-mix(in oklab, var(--foreground) 5%, transparent)",
  radius: CHART_BAR_RADIUS,
} as const;


/* ------------------------------------------------------------------ *
 * Tooltip
 * ------------------------------------------------------------------ */

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number }>;
  formatter?: (value: number) => string;
}

/** One tooltip for every chart: rounded, elevated, swatched, aligned. */
export function ChartTooltip({ active, label, payload, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const fmt = formatter ?? ((v: number) => v.toLocaleString());
  return (
    <div
      className="rounded-xl border border-border bg-popover/95 material-panel px-3 py-2 shadow-[var(--shadow-elevated)] min-w-[9rem]"
      role="presentation"
    >
      {label !== undefined && (
        <div className="text-caption text-muted-foreground mb-1.5">{String(label)}</div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={`${entry.dataKey ?? i}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              {entry.name}
            </span>
            <span className="font-tnum font-medium text-foreground">
              {typeof entry.value === "number" ? fmt(entry.value) : String(entry.value ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Frame: title, legend, keyboard exploration, SR data table
 * ------------------------------------------------------------------ */

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

interface ChartFrameProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  series: ChartSeries[];
  data: Array<Record<string, unknown>>;
  /** Key holding the x-axis label for each row. */
  labelKey: string;
  formatValue?: (value: number) => string;
  className?: string;
  height?: number;
  children: ReactNode;
}

/**
 * Wraps a Recharts graph with Apple-style chrome:
 * shared header, legend, keyboard-navigable data points announced through a
 * live region, and a screen-reader data table fallback.
 */
export function ChartFrame({
  title,
  description,
  actions,
  series,
  data,
  labelKey,
  formatValue,
  className,
  height = 260,
  children,
}: ChartFrameProps) {
  const tableId = useId();
  const [cursor, setCursor] = useState<number | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());

  const announcement = useMemo(() => {
    if (cursor === null || !data[cursor]) return "";
    const row = data[cursor] as Record<string, unknown>;
    const values = series
      .map((s) => `${s.label}: ${typeof row[s.key] === "number" ? fmt(row[s.key] as number) : "—"}`)
      .join(", ");
    return `${String(row[labelKey])}. ${values}. Point ${cursor + 1} of ${data.length}.`;
  }, [cursor, data, series, labelKey, fmt]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!data.length) return;
    const last = data.length - 1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        setCursor((c) => (c === null ? 0 : Math.min(last, c + 1)));
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        setCursor((c) => (c === null ? last : Math.max(0, c - 1)));
        break;
      case "Home":
        event.preventDefault();
        setCursor(0);
        break;
      case "End":
        event.preventDefault();
        setCursor(last);
        break;
      case "Escape":
        setCursor(null);
        (event.currentTarget as HTMLDivElement).blur();
        break;
      default:
        break;
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow duration-300",
        className,
      )}
      aria-labelledby={`${tableId}-title`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 id={`${tableId}-title`} className="text-titlecard">{title}</h3>
          {description && <p className="text-caption text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <ul className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground" aria-label="Legend">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
          {actions}
        </div>
      </header>

      <div
        role="img"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setCursor(null)}
        aria-label={`${title} chart. Use arrow keys to read data points, Escape to exit. A data table follows.`}
        aria-describedby={`${tableId}-hint`}
        className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        style={{ height }}
      >
        {children}
      </div>

      <p id={`${tableId}-hint`} className="sr-only">
        Focus this chart and use the left and right arrow keys to hear each data point.
      </p>

      {/* Live announcement for keyboard exploration */}
      <div ref={regionRef} aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {cursor !== null && announcement && (
        <p className="mt-3 text-caption text-muted-foreground font-tnum" aria-hidden="true">
          {announcement}
        </p>
      )}

      {/* Screen-reader data table fallback */}
      <table className="sr-only">
        <caption>{title} data</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.key} scope="col">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <th scope="row">{String(row[labelKey])}</th>
              {series.map((s) => (
                <td key={s.key}>{typeof row[s.key] === "number" ? fmt(row[s.key] as number) : "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
