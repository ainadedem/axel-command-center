import type { ReactNode, CSSProperties } from "react";
import { Columns3, RotateCcw, MoveHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ColumnPrefs } from "@/lib/column-prefs";
import { ResizeHandle } from "@/components/resizable-columns";

/**
 * Shared list-table primitives.
 *
 * Rules enforced here so every list page behaves the same:
 *  - the table always fits its container (`table-fixed`, no `min-width`,
 *    no horizontal scrollbar) — extra columns are toggled from the picker;
 *  - every cell keeps its value on a single truncated line with a tooltip;
 *  - row actions live on their own padded line under the data row.
 */

export function ListTableShell({ children, className, scrollX }: { children: ReactNode; className?: string; scrollX?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden", className)}>
      <div className={cn("stacked-table", scrollX && "md:overflow-x-auto")}>{children}</div>
    </div>
  );
}

export function ListTable({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <table style={style} className={cn("w-full table-fixed text-sm", className)}>{children}</table>;
}

export function ListHeadRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border", className)}>
      {children}
    </tr>
  );
}

export function ListTh({
  children,
  className,
  width,
  align = "left",
  onResizeStart,
}: {
  children?: ReactNode;
  className?: string;
  /** e.g. "12%" or "7rem" — `table-fixed` uses the header widths. */
  width?: string;
  align?: "left" | "right" | "center";
  /** When provided, renders a drag handle that resizes this column. */
  onResizeStart?: (e: React.MouseEvent) => void;
}) {
  const style: CSSProperties | undefined = width ? { width } : undefined;
  return (
    <th
      style={style}
      className={cn(
        "font-medium px-4 py-3 truncate",
        onResizeStart && "relative",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        className,
      )}
    >
      {children}
      {onResizeStart && <ResizeHandle onMouseDown={onResizeStart} />}
    </th>
  );
}


export function ListTd({
  children,
  className,
  title,
  align = "left",
  /** Opt out of single-line truncation (rare — badges that must wrap). */
  wrap,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  align?: "left" | "right" | "center";
  wrap?: boolean;
}) {
  return (
    <td
      title={title}
      className={cn(
        "px-4 py-3 align-middle",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        wrap ? "min-w-0" : "truncate",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Second tier of a record: a padded, full-width action bar. */
export function ListRowActions({
  colSpan,
  children,
  className,
}: {
  colSpan: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr data-row-actions className={cn("border-b border-border/40 last:border-0", className)}>
      <td colSpan={colSpan} className="px-4 pb-0 pt-0">
        <div className="row-actions-grid">
          <div className="row-actions-inner">
            <div className="flex flex-wrap items-center gap-1.5 pb-3 pt-0.5">{children}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

const toneClasses: Record<string, string> = {
  default: "hover:bg-surface-elevated hover:text-foreground",
  success: "hover:bg-success/10 hover:text-success hover:border-success/30",
  warning: "hover:bg-warning/10 hover:text-warning hover:border-warning/30",
  danger: "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30",
};

export function RowAction({
  icon,
  label,
  onClick,
  tone = "default",
  disabled,
  title,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "success" | "warning" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      className={cn(
        "row-action inline-flex items-center h-7 px-2 rounded-full border border-border/60 bg-card/40",
        "text-[11px] font-medium text-muted-foreground",
        "transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        "hover:-translate-y-px active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none",
        toneClasses[tone],
      )}
    >
      <span className="shrink-0 inline-flex items-center justify-center">{icon}</span>
      <span className="row-action-label">{label}</span>
    </button>
  );
}


/** Toolbar control that switches optional columns on and off. */
export function ColumnPicker({ prefs, className, onResetWidths }: { prefs: ColumnPrefs; className?: string; onResetWidths?: () => void }) {
  const hidden = prefs.columns.filter((c) => !prefs.on(c.key)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 px-2.5 text-xs gap-1.5", className)}>
          <Columns3 className="h-3.5 w-3.5" />
          Columns
          {hidden > 0 && (
            <span className="ml-0.5 rounded-full bg-primary/10 text-primary px-1.5 text-[10px] leading-4">{hidden}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {prefs.columns.map((c) => {
          const locked = (c.priority ?? "default") === "always";
          return (
            <DropdownMenuCheckboxItem
              key={c.key}
              checked={prefs.on(c.key)}
              disabled={locked}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => prefs.toggle(c.key)}
              className="text-xs"
            >
              {c.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onSelect={() => prefs.reset()} disabled={prefs.isDefault}>
          <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset to default
        </DropdownMenuItem>
        {onResetWidths && (
          <DropdownMenuItem className="text-xs" onSelect={() => onResetWidths()}>
            <MoveHorizontal className="h-3.5 w-3.5 mr-2" /> Reset column widths
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
