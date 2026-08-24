import { useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Generic drag-and-drop Kanban board.
 *
 * Cards move between columns with the mouse (HTML5 drag events) or the
 * keyboard (focus a card, then Alt + Left/Right). The board never mutates
 * data itself — it calls `onMove(item, columnKey)` and lets the page decide
 * how to persist, validate or roll back the change.
 */

export interface KanbanColumnDef {
  key: string;
  label: string;
  /** Tailwind class for the small colour dot in the header. */
  dot?: string;
  /** Secondary line under the header (totals, probability…). */
  meta?: ReactNode;
}

export function KanbanBoard<T>({
  columns,
  items,
  columnOf,
  idOf,
  labelOf,
  renderCard,
  renderActions,
  actionsLabel = "More actions",
  accentOf,
  onMove,
  canMove,
  onCardClick,
  className,
  minHeight = "min-h-[280px]",
}: {
  columns: KanbanColumnDef[];
  items: T[];
  columnOf: (item: T) => string;
  idOf: (item: T) => string;
  /** Accessible name of a card, used in the live region. */
  labelOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /**
   * Quick actions. Rendered inside an overflow (…) menu in the card corner so
   * the card itself stays two lines tall.
   */
  renderActions?: (item: T) => ReactNode;
  /** Optional accessible label for the overflow button. */
  actionsLabel?: string;
  /** Optional colour code (e.g. per client) shown as a left accent bar. */
  accentOf?: (item: T) => string | undefined;
  onMove: (item: T, columnKey: string) => void;
  /** Optional guard — return false to reject a drop. */
  canMove?: (item: T, columnKey: string) => boolean;
  onCardClick?: (item: T) => void;
  className?: string;
  minHeight?: string;
}) {

  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const byId = new Map(items.map((i) => [idOf(i), i]));

  const move = (item: T, to: string) => {
    const from = columnOf(item);
    if (from === to) return;
    if (canMove && !canMove(item, to)) {
      setAnnouncement(`${labelOf(item)} cannot move to ${columns.find((c) => c.key === to)?.label ?? to}.`);
      return;
    }
    onMove(item, to);
    setAnnouncement(`${labelOf(item)} moved to ${columns.find((c) => c.key === to)?.label ?? to}.`);
  };

  const moveBy = (item: T, delta: number) => {
    const keys = columns.map((c) => c.key);
    const i = keys.indexOf(columnOf(item));
    const j = i + delta;
    if (i < 0 || j < 0 || j >= keys.length) return;
    move(item, keys[j]);
  };

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">{announcement}</div>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start", className)}>
        {columns.map((col) => {
          const colItems = items.filter((i) => columnOf(i) === col.key);
          const isOver = overKey === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overKey !== col.key) setOverKey(col.key);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (overKey === col.key) setOverKey(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragId ?? e.dataTransfer.getData("text/plain");
                const item = id ? byId.get(id) : undefined;
                if (item) move(item, col.key);
                setDragId(null);
                setOverKey(null);
              }}
              className={cn(
                "rounded-lg border bg-surface overflow-hidden flex flex-col transition-[background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                minHeight,
                isOver ? "border-primary bg-[var(--primary-container)]/25 shadow-[0_0_0_1px_var(--primary)]" : "border-border",
              )}
            >
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  {col.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", col.dot)} />}
                  <div className="text-xs font-medium truncate">{col.label}</div>
                </div>
                <div className="text-[10px] text-muted-foreground font-tnum shrink-0">{colItems.length}</div>
              </div>
              {col.meta !== undefined && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground font-tnum border-b border-border/50">{col.meta}</div>
              )}
              <div className="p-2 space-y-1.5 flex-1">
                {colItems.map((item) => {
                  const id = idOf(item);
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${labelOf(item)}, ${col.label}. Alt plus left or right arrow moves it to another column.`}
                      draggable
                      onDragStart={(e) => {
                        setDragId(id);
                        e.dataTransfer.effectAllowed = "move";
                        try { e.dataTransfer.setData("text/plain", id); } catch { /* ignore */ }
                      }}
                      onDragEnd={() => { setDragId(null); setOverKey(null); }}
                      onClick={() => onCardClick?.(item)}
                      onKeyDown={(e) => {
                        if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                          e.preventDefault();
                          moveBy(item, e.key === "ArrowLeft" ? -1 : 1);
                          return;
                        }
                        if (e.key === "Enter" || e.key === " ") {
                          if (!onCardClick) return;
                          e.preventDefault();
                          onCardClick(item);
                        }
                      }}
                      data-dragging={dragId === id ? "" : undefined}
                      style={accentOf?.(item) ? { boxShadow: `inset 3px 0 0 0 ${accentOf(item)}` } : undefined}
                      className={cn(
                        "rounded-md bg-surface-elevated border border-border/60 p-2.5 group text-left w-full",
                        "cursor-grab active:cursor-grabbing",
                        "transition-[opacity,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                        "hover:border-border hover:shadow-[var(--shadow-card)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        dragId === id && "opacity-45",
                      )}
                    >
                      {renderCard(item)}
                      {renderActions && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={cn(
                            "flex items-center gap-1 mt-2 pt-2 border-t border-border/40",
                            "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                            "transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
                          )}
                        >
                          {renderActions(item)}
                        </div>
                      )}
                    </div>

                  );
                })}
                {colItems.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/60 px-2 py-6 text-center text-[11px] text-muted-foreground">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
