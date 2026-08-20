import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Measures a container and reports how many fixed-width items fit on one line.
 * Used by compact toolbars that must never wrap: leftovers go to an overflow menu.
 */
export function useFixedOverflow(
  total: number,
  opts?: { itemWidth?: number; reserve?: number; min?: number },
) {
  const itemWidth = opts?.itemWidth ?? 38; // 32px chip + 6px gap
  const reserve = opts?.reserve ?? 38; // room for the overflow trigger
  const min = opts?.min ?? 0;

  const [width, setWidth] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const setNode = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const sync = () => setWidth(node.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  let visible = total;
  if (width != null) {
    const fitsAll = Math.floor((width + 6) / itemWidth);
    if (fitsAll < total) {
      visible = Math.max(min, Math.floor((width - reserve + 6) / itemWidth));
    }
  }
  visible = Math.max(0, Math.min(total, visible));

  return { ref: setNode, visible, hidden: total - visible, measured: width != null };
}
