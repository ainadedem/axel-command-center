import { MoreHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { STATUS_META, PO_META, type StatusTone } from "@/components/status-badge";
import { useFixedOverflow } from "@/hooks/use-fixed-overflow";

const activeTone: Record<StatusTone, string> = {
  neutral: "border-muted-foreground/40 text-foreground bg-muted/60",
  info: "border-primary/50 text-primary bg-primary/15",
  warning: "border-warning/50 text-warning bg-warning/15",
  success: "border-success/50 text-success bg-success/15",
  danger: "border-destructive/50 text-destructive bg-destructive/15",
  muted: "border-muted-foreground/40 text-muted-foreground bg-muted/60",
};

const PO_HINT: Record<PoState, string> = {
  linked: "Client purchase order attached",
  waived: "Purchase order requirement waived",
  missing: "No purchase order on file",
};

function Chip({
  label,
  hint,
  icon,
  tone,
  count,
  active,
  onClick,
  iconOnly,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  tone: StatusTone;
  count: number;
  active: boolean;
  onClick: () => void;
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            aria-label={`${label} · ${count}`}
            className={cn(
              "inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-full border text-xs font-medium relative",
              "transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              active
                ? activeTone[tone]
                : "border-border text-muted-foreground bg-surface hover:bg-[var(--surface-container)] hover:text-foreground",
              count === 0 && !active && "opacity-55",
            )}
          >
            {icon}
            <span className="absolute -right-0.5 -top-0.5 font-tnum text-[9px] leading-none px-1 rounded-full bg-surface border border-border text-muted-foreground">
              {count}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span className="font-medium">{label}</span>
          {hint ? <span className="text-muted-foreground"> — {hint}</span> : null}
          <span className="font-tnum"> · {count}</span>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={hint ? `${label} — ${hint}` : label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium",
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

type Entry = {
  key: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  tone: StatusTone;
  count: number;
  active: boolean;
  onClick: () => void;
};

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
  iconOnly = false,
  overflow = false,
  forceOverflowAll = false,
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
  iconOnly?: boolean;
  /** Keep every chip on one line: leftovers move into a "More filters" menu. */
  overflow?: boolean;
  /** Collapse every chip into the overflow menu (mobile). */
  forceOverflowAll?: boolean;
}) {
  const anyActive = selected.length > 0 || poSelected.length > 0;

  const statusEntries: Entry[] = statuses.map((s) => {
    const meta = STATUS_META[s];
    return {
      key: `s:${s}`,
      label: meta?.label ?? s,
      icon: meta?.icon,
      tone: meta?.tone ?? "neutral",
      count: statusCount(s),
      active: selected.includes(s),
      onClick: () => onToggleStatus(s),
    };
  });
  const poEntries: Entry[] = (["linked", "waived", "missing"] as PoState[]).map((s) => {
    const meta = PO_META[s];
    return {
      key: `p:${s}`,
      label: meta.label,
      hint: PO_HINT[s],
      icon: meta.icon,
      tone: meta.tone,
      count: poCount(s),
      active: poSelected.includes(s),
      onClick: () => onTogglePo(s),
    };
  });
  const all = [...statusEntries, ...poEntries];

  const clearBtn = anyActive ? (
    <button
      type="button"
      onClick={onClear}
      title="Clear filters"
      aria-label="Clear filters"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        iconOnly
          ? "h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)]"
          : "gap-1 h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)]",
      )}
    >
      <X className={iconOnly ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {!iconOnly && "Clear filters"}
    </button>
  ) : null;

  if (overflow) {
    return (
      <TooltipProvider delayDuration={150}>
        <OverflowRow
          entries={all}
          statusEntryCount={statusEntries.length}
          iconOnly={iconOnly}
          forceOverflowAll={forceOverflowAll}
          className={className}
          trailing={clearBtn}
        />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn(flat ? "[display:contents]" : "flex flex-wrap items-center gap-1.5", className)}>
        {statusEntries.map((e) => (
          <Chip key={e.key} {...e} iconOnly={iconOnly} />
        ))}
        <span className="mx-1 h-5 w-px bg-border shrink-0" aria-hidden />
        {poEntries.map((e) => (
          <Chip key={e.key} {...e} iconOnly={iconOnly} />
        ))}
        {clearBtn}
      </div>
    </TooltipProvider>
  );
}

function OverflowRow({
  entries,
  statusEntryCount,
  iconOnly,
  forceOverflowAll,
  className,
  trailing,
}: {
  entries: Entry[];
  statusEntryCount: number;
  iconOnly?: boolean;
  forceOverflowAll?: boolean;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const { ref, visible } = useFixedOverflow(entries.length, { itemWidth: iconOnly ? 38 : 104 });
  const shown = forceOverflowAll ? [] : entries.slice(0, visible);
  const hidden = forceOverflowAll ? entries : entries.slice(visible);
  const hiddenActive = hidden.filter((e) => e.active).length;

  return (
    <div ref={ref} className={cn("flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden", className)}>
      {shown.map((e, i) => (
        <span key={e.key} className="contents">
          {i === statusEntryCount && <span className="mx-0.5 h-5 w-px bg-border shrink-0" aria-hidden />}
          <Chip {...e} iconOnly={iconOnly} />
        </span>
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={`More filters · ${hidden.length}`}
              aria-label={`More filters (${hidden.length})`}
              className={cn(
                "relative inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-full border",
                "transition-[color,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                hiddenActive > 0
                  ? "border-primary/50 text-primary bg-primary/15"
                  : "border-border text-muted-foreground bg-surface hover:bg-[var(--surface-container)] hover:text-foreground",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
              {hiddenActive > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] grid place-items-center font-medium">
                  {hiddenActive}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 max-h-[60vh] overflow-y-auto" align="start">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">More filters</div>
            <div className="space-y-0.5">
              {hidden.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  onClick={e.onClick}
                  aria-pressed={e.active}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left hover:bg-surface-elevated",
                    e.active && "bg-primary/10 text-foreground font-medium",
                  )}
                >
                  <span className="shrink-0">{e.icon}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {e.label}
                    {e.hint && <span className="text-muted-foreground"> — {e.hint}</span>}
                  </span>
                  <span className="font-tnum text-[10px] text-muted-foreground">{e.count}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {trailing}
    </div>
  );
}
