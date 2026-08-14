import { useState, type ReactNode } from "react";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Moves an item inside an array, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * Drag-and-drop reordering for document line items.
 * Returns props for each row plus a keyboard-accessible handle.
 */
export function useLineReorder(onReorder: (from: number, to: number) => void) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = (from: number, to: number, total?: number) => {
    if (from === to) return;
    onReorder(from, to);
    setAnnouncement(
      `Line ${from + 1} moved to position ${to + 1}${total ? ` of ${total}` : ""}.`,
    );
  };


  const rowProps = (index: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (dragIndex === null || dragIndex === index) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overIndex !== index) setOverIndex(index);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIndex !== null) onReorder(dragIndex, index);
      setDragIndex(null);
      setOverIndex(null);
    },
    "data-dragging": dragIndex === index ? "" : undefined,
    className: cn(
      "transition-[background-color,opacity,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)]",
      dragIndex === index && "opacity-45",
      overIndex === index && dragIndex !== index && "shadow-[inset_0_2px_0_0_var(--primary)]",
    ),
  });

  const handleProps = (index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", String(index));
      } catch {
        /* ignore */
      }
    },
    onDragEnd: () => {
      setDragIndex(null);
      setOverIndex(null);
    },
  });

  return { rowProps, handleProps, dragIndex };
}

export function DragHandle({
  index,
  total,
  handleProps,
  onMove,
  className,
}: {
  index: number;
  total: number;
  handleProps: Record<string, unknown>;
  onMove: (from: number, to: number) => void;
  className?: string;
}): ReactNode {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <span
        {...handleProps}
        role="button"
        tabIndex={-1}
        aria-label={`Reorder line ${index + 1}`}
        title="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex flex-col -space-y-1">
        <button
          type="button"
          aria-label={`Move line ${index + 1} up`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          className="text-muted-foreground/60 hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          aria-label={`Move line ${index + 1} down`}
          disabled={index >= total - 1}
          onClick={() => onMove(index, index + 1)}
          className="text-muted-foreground/60 hover:text-foreground disabled:opacity-25 disabled:pointer-events-none transition-colors duration-150"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}
