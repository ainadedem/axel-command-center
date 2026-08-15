import { useRef, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Row windowing for long finance tables.
 *
 * Renders only the rows in view plus a small overscan, and pads the table with
 * two spacer rows so scroll height, column widths and sticky headers stay
 * exactly as they are today. Height is reserved up front, so nothing shifts.
 */

export const VIRTUAL_ROW_HEIGHT = 34;

/** Lists below this length render in full — windowing adds nothing. */
export const VIRTUALIZE_THRESHOLD = 60;

export function useRowWindow<T>({
  rows,
  scrollRef,
  rowHeight = VIRTUAL_ROW_HEIGHT,
  enabled = true,
}: {
  rows: T[];
  scrollRef: RefObject<HTMLElement | null>;
  rowHeight?: number;
  enabled?: boolean;
}) {
  const active = enabled && rows.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: active ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  if (!active) {
    return { active: false as const, items: rows, padTop: 0, padBottom: 0 };
  }

  const virtualItems = virtualizer.getVirtualItems();
  const total = virtualizer.getTotalSize();
  const padTop = virtualItems.length ? virtualItems[0].start : 0;
  const padBottom = virtualItems.length
    ? total - virtualItems[virtualItems.length - 1].end
    : total;

  return {
    active: true as const,
    items: virtualItems.map((v) => rows[v.index]),
    padTop,
    padBottom,
  };
}

/** Spacer row keeping the scroll height correct above/below the window. */
export function SpacerRow({ height, colSpan }: { height: number; colSpan: number }) {
  if (height <= 0) return null;
  return (
    <tr aria-hidden="true">
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

/** Scroll container for a windowed table body. */
export function VirtualScroller({
  children,
  scrollRef,
  className,
  maxHeight = "calc(100dvh - 22rem)",
}: {
  children: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div ref={scrollRef} className={className} style={{ maxHeight, overflowY: "auto" }}>
      {children}
    </div>
  );
}

export function useScrollRef() {
  return useRef<HTMLDivElement>(null);
}
