import { useState, useRef, useEffect } from "react";
import {
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subMonths, subQuarters, subYears,
  format, parseISO, isValid,
} from "date-fns";
import { CalendarRange, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Period {
  from: Date;
  to: Date;
  label: string;
}

const now = () => new Date();

type Preset = {
  key: string;
  label: string;
  resolve: () => Period;
};

const PRESETS: Preset[] = [
  { key: "this_month", label: "Ce mois", resolve: () => ({ from: startOfMonth(now()), to: endOfMonth(now()), label: "Ce mois" }) },
  { key: "last_month", label: "Mois dernier", resolve: () => { const d = subMonths(now(), 1); return { from: startOfMonth(d), to: endOfMonth(d), label: "Mois dernier" }; } },
  { key: "this_quarter", label: "Ce trimestre", resolve: () => ({ from: startOfQuarter(now()), to: endOfQuarter(now()), label: "Ce trimestre" }) },
  { key: "last_quarter", label: "Trimestre dernier", resolve: () => { const d = subQuarters(now(), 1); return { from: startOfQuarter(d), to: endOfQuarter(d), label: "Trimestre dernier" }; } },
  { key: "ytd", label: "Depuis janvier", resolve: () => ({ from: startOfYear(now()), to: now(), label: "Depuis janvier" }) },
  { key: "last_year", label: "Année dernière", resolve: () => { const d = subYears(now(), 1); return { from: startOfYear(d), to: endOfYear(d), label: "Année dernière" }; } },
  { key: "all", label: "Tout", resolve: () => ({ from: new Date(2020, 0, 1), to: new Date(2030, 11, 31), label: "Tout" }) },
];

export function defaultPeriod(): Period {
  return PRESETS[0].resolve();
}

/** Default for PCG accounting pages — shows all entries (matches original all-time view). */
export function defaultAccountingPeriod(): Period {
  return PRESETS.find((p) => p.key === "all")!.resolve();
}

interface Props {
  value: Period;
  onChange: (p: Period) => void;
  className?: string;
}

export function PeriodPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyCustom = () => {
    const from = parseISO(customFrom);
    const to = parseISO(customTo);
    if (!isValid(from) || !isValid(to) || from > to) return;
    onChange({
      from,
      to,
      label: `${format(from, "d MMM yy")} – ${format(to, "d MMM yy")}`,
    });
    setOpen(false);
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-surface hover:bg-surface-elevated text-sm transition"
      >
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{value.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 z-50 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            Période
          </div>
          <div className="py-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => { onChange(p.resolve()); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent transition",
                  value.label === p.resolve().label && "text-primary font-medium",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="border-t border-border px-3 py-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Période personnalisée</div>
            <div className="flex gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 h-8 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 h-8 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo}
              className="w-full h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-40"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
