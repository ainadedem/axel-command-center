import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, STATUS_META } from "@/components/status-badge";
import { cn } from "@/lib/utils";

/**
 * Status badge that doubles as a picker.
 *
 * Lists, boards and detail panels use it so a status can be changed in one
 * click instead of re-opening the whole document editor. The menu never
 * decides what a transition means — it just calls `onSelect`, so guarded
 * moves (paid with a balance, cancellations) can still open their dialogs.
 */
export function StatusMenu({
  status,
  statuses,
  onSelect,
  disabled,
  disabledReason,
  title,
  className,
  align = "start",
}: {
  status: string;
  statuses: readonly string[];
  onSelect: (next: string) => void;
  disabled?: boolean;
  /** Tooltip shown when the badge is not editable. */
  disabledReason?: string;
  title?: string;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  if (disabled) {
    return <StatusBadge status={status} title={disabledReason ?? title} className={className} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Status: ${STATUS_META[status]?.label ?? status}. Change status`}
          title={title ?? "Change status"}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full group/status",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <StatusBadge status={status} title={title} />
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/60 transition-colors group-hover/status:text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44" onClick={(e) => e.stopPropagation()}>
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={(e) => {
              e.preventDefault();
              if (s === status) return;
              onSelect(s);
            }}
            className="gap-2 text-xs"
          >
            <StatusBadge status={s} showLabel />
            {s === status && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
