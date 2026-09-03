import type { ReactNode, CSSProperties } from "react";
import { Columns3, RotateCcw, MoveHorizontal, ArrowLeftRight, Loader2 } from "lucide-react";
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

export function ListTableShell({ children, className, scrollX, announcement, stickyHeader, scrollRef, maxHeight }: { children: ReactNode; className?: string; scrollX?: boolean; announcement?: string; stickyHeader?: boolean; scrollRef?: React.RefObject<HTMLDivElement | null>; maxHeight?: string }) {
  return (
    <div className={cn("panel overflow-clip", className)}>
      {announcement !== undefined && (
        <div aria-live="polite" role="status" className="sr-only">{announcement}</div>
      )}
      <div
        ref={scrollRef}
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        className={cn("stacked-table list-aligned", stickyHeader && "sticky-head", scrollX && "md:overflow-x-auto")}
      >
        {children}
      </div>
    </div>
  );
}



export function ListTable({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <table style={style} className={cn("w-full table-fixed text-sm", className)}>{children}</table>;
}

export function ListHeadRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("text-[11px] tracking-[0.04em] text-muted-foreground border-b border-border/70", className)}>
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
  dragProps,
  keyProps,
}: {
  children?: ReactNode;
  className?: string;
  /** e.g. "12%" or "7rem" — `table-fixed` uses the header widths. */
  width?: string;
  align?: "left" | "right" | "center";
  /** When provided, renders a drag handle that resizes this column. */
  onResizeStart?: (e: React.MouseEvent) => void;
  /** Native drag handlers that reorder this column. */
  dragProps?: Record<string, unknown>;
  /** Keyboard equivalents for drag/resize (Alt+Arrow, Shift+Arrow). */
  keyProps?: Record<string, unknown>;
}) {
  const style: CSSProperties | undefined = width ? { width } : undefined;
  return (
    <th
      style={style}
      {...(dragProps ?? {})}
      {...(keyProps ?? {})}
      className={cn(
        "font-medium px-4 py-2 truncate select-none",
        (onResizeStart || dragProps) && "relative",
        keyProps && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        dragProps && "cursor-grab active:cursor-grabbing hover:text-foreground transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        dragProps && "data-[drag-over=right]:shadow-[inset_-2px_0_0_0_var(--primary)]",
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
  /**
   * Allow the content to wrap onto a limited number of lines instead of being
   * cut off. Use for document numbers and object titles, which must stay
   * readable even in a narrow column.
   */
  lines,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  align?: "left" | "right" | "center";
  wrap?: boolean;
  lines?: 2 | 3;
}) {
  return (
    <td
      title={title}
      className={cn(
        "px-4 py-1.5 align-middle",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        lines ? "min-w-0 whitespace-normal break-words" : wrap ? "min-w-0" : "truncate",
        className,
      )}
    >
      {/* Line clamping lives on an inner block: applying `display:-webkit-box`
          to the <td> itself pulls the cell out of the table's column flow and
          shifts every following cell under the wrong header. */}
      {lines ? (
        <span className={cn("block", lines === 2 ? "line-clamp-2" : "line-clamp-3")}>{children}</span>
      ) : (
        children
      )}
    </td>
  );
}



/** Header cell above the leading actions column. */
export function ListActionsTh({ width = "0", className }: { width?: string; className?: string }) {
  return (
    <th scope="col" style={{ width, padding: 0 }} className={cn("select-none", className)}>
      <span className="sr-only">Actions</span>
    </th>
  );
}

/**
 * Leading cell of a record holding its icon-only actions.
 * Buttons stay invisible until the row is hovered or focused.
 */
export function ListRowActions({
  children,
  className,
  busy,
}: {
  /** Kept for call-site compatibility; the actions no longer span the row. */
  colSpan?: number;
  children: ReactNode;
  className?: string;
  /** A row action is running — keep the pill visible and block further clicks. */
  busy?: boolean;
}) {
  return (
    <td className={cn("row-actions-cell px-2 py-0 align-middle whitespace-nowrap", className)}>
      <div
        className={cn("row-actions-inner", busy && "pointer-events-none")}
        data-busy={busy ? "true" : undefined}
        aria-busy={busy || undefined}
      >
        {children}
      </div>
    </td>
  );
}


const toneClasses: Record<string, string> = {
  default: "",
  success: "hover:bg-success/10 hover:text-success",
  warning: "hover:bg-warning/10 hover:text-warning",
  danger: "hover:bg-destructive/10 hover:text-destructive",
};


export function RowAction({
  icon,
  label,
  onClick,
  tone = "default",
  disabled,
  title,
  busy,
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "success" | "warning" | "danger";
  disabled?: boolean;
  title?: string;
  /** Swap the icon for a spinner while this action runs. */
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled || busy}
      title={title ?? label}
      aria-label={label}
      aria-busy={busy || undefined}

      className={cn(
        "row-action inline-flex items-center justify-center h-7 w-7 rounded-full border-0 bg-transparent",
        "text-foreground/70",
        // Same motion contract as the sidebar nav items.
        "transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
        "hover:bg-[var(--surface-container)] hover:text-foreground active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none",
        toneClasses[tone],

      )}
    >
      <span className="shrink-0 inline-flex items-center justify-center">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : icon}
      </span>

      <span className="sr-only">{label}</span>
    </button>
  );
}



/** Toolbar control that switches optional columns on and off. */
export function ColumnPicker({ prefs, className, onResetWidths, onResetOrder, iconOnly = false }: { prefs: ColumnPrefs; className?: string; onResetWidths?: () => void; onResetOrder?: () => void; iconOnly?: boolean }) {
  const hidden = prefs.columns.filter((c) => !prefs.on(c.key)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            title="Columns"
            aria-label="Columns"
            className={cn(
              "relative inline-flex items-center justify-center h-8 w-8 rounded-full border-0 bg-surface text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              className,
            )}
          >
            <Columns3 className="h-4 w-4" />
            {hidden > 0 && (
              <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary/10 text-primary px-1 text-[10px] leading-4 border border-surface">{hidden}</span>
            )}
          </button>
        ) : (
          <Button variant="outline" size="sm" className={cn("h-8 px-2.5 text-xs gap-1.5", className)}>
            <Columns3 className="h-3.5 w-3.5" />
            Columns
            {hidden > 0 && (
              <span className="ml-0.5 rounded-full bg-primary/10 text-primary px-1.5 text-[10px] leading-4">{hidden}</span>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs">Visible columns</DropdownMenuLabel>
        {prefs.setAll && (
          <>
            <div className="flex items-center gap-1.5 px-2 pb-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-[11px]"
                onClick={() => prefs.setAll?.(true)}
              >
                Show all
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-[11px]"
                onClick={() => prefs.setAll?.(false)}
              >
                Hide optional
              </Button>
            </div>
          </>
        )}
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
              <span className="flex w-full items-center justify-between gap-2">
                {c.label}
                {locked && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Locked</span>}
              </span>
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
        {onResetOrder && (
          <DropdownMenuItem className="text-xs" onSelect={() => onResetOrder()}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-2" /> Reset column order
          </DropdownMenuItem>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
