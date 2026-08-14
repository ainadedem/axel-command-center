import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";

import {
  AGING_BUCKETS,
  AGING_TONE_DOT,
  AGING_TONE_TEXT,
  type AgingKey,
  type AgingResult,
} from "@/lib/aging";
import { AgingDrawer, type AgingDrawerItem } from "@/components/aging-drawer";
import {
  CHART_SEMANTIC,
  ChartFrame,
  ChartTooltip,
  chartAxisProps,
  chartBarProps,
  chartCursor,
  chartGridProps,
  chartMargin,
} from "@/components/charts";
import { PanelCard } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const TONE_FILL: Record<string, string> = {
  neutral: "var(--chart-neutral)",
  primary: "var(--chart-1)",
  warning: "var(--warning)",
  danger: CHART_SEMANTIC.expense,
};

/**
 * Shared aging block: past-due tiles + bar chart, with click-to-filter.
 * Used by Invoices, Receivables and Payables so the bucket definitions and
 * interactions stay identical everywhere.
 *
 * When `itemsInBucket` is supplied, clicking a tile or bar also opens a drawer
 * listing the exact records behind that bucket, each jumping to its row.
 */
export function AgingPanel({
  aging,
  selected,
  onSelect,
  format,
  noun,
  title = "Aging",
  description,
  tilesTitle = "Aging — days past due",
  itemsInBucket,
  onJump,
  drawerBucket,
  onDrawerBucketChange,
  loading,
}: {
  aging: AgingResult;
  selected: AgingKey | null;
  onSelect: (key: AgingKey | null) => void;
  format: (v: number) => string;
  /** Singular noun for counts, e.g. "invoice". */
  noun: string;
  title?: string;
  description?: string;
  tilesTitle?: string;
  /** Records behind a bucket — enables the click-through drawer. */
  itemsInBucket?: (key: AgingKey) => AgingDrawerItem[];
  /** Called when a drawer row is clicked. */
  onJump?: (item: AgingDrawerItem) => void;
  /** Controlled drawer bucket — lets routes restore it from the URL. */
  drawerBucket?: AgingKey | null;
  onDrawerBucketChange?: (key: AgingKey | null) => void;
  /** Records still resolving (hydration / fetch) — drawer shows skeletons. */
  loading?: boolean;
}) {
  const [uncontrolledKey, setUncontrolledKey] = useState<AgingKey | null>(null);
  const drawerKey = drawerBucket !== undefined ? drawerBucket : uncontrolledKey;
  const setDrawerKey = (key: AgingKey | null) => {
    if (drawerBucket === undefined) setUncontrolledKey(key);
    onDrawerBucketChange?.(key);
  };

  if (!aging.hasData) return null;

  const openBucket = (key: AgingKey) => {
    onSelect(key);
    if (itemsInBucket) setDrawerKey(key);
  };
  const toggle = (key: AgingKey) => (selected === key && !itemsInBucket ? onSelect(null) : openBucket(key));

  const chartData = aging.rows.map((r) => ({ ...r })) as unknown as (Record<string, unknown> & typeof aging.rows[number])[];

  return (
    <>
      <PanelCard bodyClassName="p-0 pb-0 px-0" className="overflow-hidden">
        <div className="px-5 py-2.5 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground truncate">{tilesTitle}</div>
          </div>
          <div className="flex items-center gap-1.5">
            {selected && (
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear bucket filter
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", !open && "-rotate-90")} aria-hidden="true" />
              {open ? "Hide chart" : "Show chart"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/40">
          {aging.pastDue.map((b) => {
            const active = selected === b.key;
            return (
              <button
                key={b.key}
                type="button"
                aria-pressed={active}
                aria-label={`Filter to ${b.label}: ${b.count} ${noun}${b.count !== 1 ? "s" : ""}`}
                onClick={() => toggle(b.key)}
                className={cn(
                  "px-4 py-3 text-left relative transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                  "hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active && "bg-surface-elevated",
                )}
              >
                {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-primary" aria-hidden="true" />}
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", b.count > 0 ? AGING_TONE_DOT[b.tone] : "bg-muted-foreground/30")} />
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{b.label}</div>
                </div>
                <div
                  className={cn(
                    "font-display text-xl font-bold font-tnum mt-1.5 leading-none",
                    b.count > 0 ? AGING_TONE_TEXT[b.tone] : "text-muted-foreground/40",
                  )}
                >
                  {b.count > 0 ? format(b.amount) : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {b.count} {noun}
                  {b.count !== 1 ? "s" : ""}
                </div>
              </button>
            );
          })}
        </div>

        {open && (
          <div className="border-t border-border p-4">
            <p className="text-caption text-muted-foreground mb-2">
              {description ?? "Open balance by days past due (MGA) — follows the current filters. Click a bar to filter."}
            </p>
            <div className="h-[200px]">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={chartMargin}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="bucket" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} width={72} tickFormatter={(v: number) => format(v)} />
                  <Tooltip content={<ChartTooltip formatter={format} />} cursor={chartCursor} />
                  <Bar
                    dataKey="amount"
                    name="Open balance"
                    {...chartBarProps}
                    className="cursor-pointer"
                    onClick={(d: unknown) => {
                      const key = (d as { payload?: { key?: AgingKey } })?.payload?.key;
                      if (key) toggle(key);
                    }}
                  >
                    {chartData.map((row) => (
                      <Cell
                        key={row.key}
                        fill={TONE_FILL[row.tone] ?? CHART_SEMANTIC.expense}
                        fillOpacity={selected && selected !== row.key ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </PanelCard>

      {itemsInBucket && (
        <AgingDrawer
          open={drawerKey !== null}
          onOpenChange={(o) => !o && setDrawerKey(null)}
          bucket={AGING_BUCKETS.find((b) => b.key === drawerKey) ?? null}
          items={drawerKey ? itemsInBucket(drawerKey) : []}
          loading={loading}
          format={format}
          noun={noun}
          onJump={(item) => {
            setDrawerKey(null);
            onJump?.(item);
          }}
        />
      )}
    </>
  );
}
