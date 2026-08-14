import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a regular <table> and makes it readable on phones.
 *
 * Desktop (md+): unchanged horizontal table.
 * Mobile: every row renders as a card, each cell prefixed with its column
 * label (read from the <thead>) — no more horizontal scrolling to reach
 * amounts, statuses or actions.
 */
export function StackedTable({
  children,
  className,
  stack = true,
}: {
  children: ReactNode;
  className?: string;
  /** Set false for numeric ledgers that should stay tabular and scroll. */
  stack?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stack) return;
    const root = ref.current;
    if (!root) return;

    const label = () => {
      const table = root.querySelector("table");
      if (!table) return;
      const heads = Array.from(table.querySelectorAll("thead th")).map((th) =>
        (th.textContent ?? "").trim(),
      );
      if (!heads.length) return;
      table.querySelectorAll("tbody tr").forEach((tr) => {
        const cells = Array.from(tr.children) as HTMLTableCellElement[];
        // Skip group/spanning rows — they already read fine stacked.
        if (cells.length === 1 && cells[0].colSpan > 1) {
          tr.setAttribute("data-stack-full", "");
          return;
        }
        cells.forEach((td, i) => {
          const text = heads[i] ?? "";
          if (text) td.setAttribute("data-label", text);
          else td.setAttribute("data-label-empty", "");
        });
      });
    };

    label();
    const obs = new MutationObserver(() => label());
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  });

  return (
    <div ref={ref} className={cn("overflow-x-auto", stack && "stacked-table", className)}>
      {children}
    </div>
  );
}
