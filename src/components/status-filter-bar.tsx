import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, PO_META, type StatusTone } from "@/components/status-badge";

const activeTone: Record<StatusTone, string> = {
  neutral: "border-muted-foreground/40 text-foreground bg-muted/60",
  info: "border-primary/50 text-primary bg-primary/15",
  warning: "border-warning/50 text-warning bg-warning/15",
  success: "border-success/50 text-success bg-success/15",
  danger: "border-destructive/50 text-destructive bg-destructive/15",
  muted: "border-muted-foreground/40 text-muted-foreground bg-muted/60",
};

function Chip({
  label,
  icon,
  tone,
  count,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  tone: StatusTone;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium",
        "transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? activeTone[tone]
          : "border-border text-muted-foreground bg-surface hover:bg-[var(--surface-container)] hover:text-foreground",
        count === 0 && !active && "opacity-55",
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="font-tnum text-[10px] opacity-70">{count}</span>
    </button>
  );
}

export type PoState = "linked" | "waived" | "missing";

export function StatusFilterBar({
  statuses,
  selected,
  onToggleStatus,
  statusCount,
  poSelected,
  onTogglePo,
  poCount,
  onClear,
  className,
  flat = false,
}: {
  statuses: string[];
  selected: string[];
  onToggleStatus: (s: string) => void;
  statusCount: (s: string) => number;
  poSelected: PoState[];
  onTogglePo: (s: PoState) => void;
  poCount: (s: PoState) => number;
  onClear: () => void;
  className?: string;
  flat?: boolean;
}) {
  const anyActive = selected.length > 0 || poSelected.length > 0;
  return (
    <div className={cn(flat ? "[display:contents]" : "flex flex-wrap items-center gap-1.5", className)}>
      {statuses.map((s) => {
        const meta = STATUS_META[s];
        return (
          <Chip
            key={s}
            label={meta?.label ?? s}
            icon={meta?.icon}
            tone={meta?.tone ?? "neutral"}
            count={statusCount(s)}
            active={selected.includes(s)}
            onClick={() => onToggleStatus(s)}
          />
        );
      })}
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      {(["linked", "waived", "missing"] as PoState[]).map((s) => {
        const meta = PO_META[s];
        return (
          <Chip
            key={s}
            label={meta.label}
            icon={meta.icon}
            tone={meta.tone}
            count={poCount(s)}
            active={poSelected.includes(s)}
            onClick={() => onTogglePo(s)}
          />
        );
      })}
      {anyActive && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
        >
          <X className="h-3.5 w-3.5" /> Clear filters
        </button>
      )}
    </div>
  );
}
