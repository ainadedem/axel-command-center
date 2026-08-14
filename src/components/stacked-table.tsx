import { useEffect } from "react";

/**
 * Mounted once in the app shell.
 *
 * Any table wrapped in an element with the `stacked-table` class gets its
 * body cells annotated with `data-label` (taken from the matching <thead>
 * cell). The CSS in styles.css then turns each row into a readable card on
 * phones instead of a horizontally scrolling desktop table.
 */
export function TableStackLabeler() {
  useEffect(() => {
    let raf = 0;

    const label = () => {
      raf = 0;
      document.querySelectorAll<HTMLElement>(".stacked-table").forEach((root) => {
        const table = root.querySelector("table");
        if (!table) return;
        const headRow = table.querySelector("thead tr:last-child");
        if (!headRow) return;
        const heads = Array.from(headRow.children).map((th) => (th.textContent ?? "").trim());
        table.querySelectorAll("tbody tr").forEach((tr) => {
          const cells = Array.from(tr.children) as HTMLTableCellElement[];
          if (cells.length <= 1 && (cells[0]?.colSpan ?? 1) > 1) {
            tr.setAttribute("data-stack-full", "");
            return;
          }
          tr.removeAttribute("data-stack-full");
          cells.forEach((td, i) => {
            const text = heads[i] ?? "";
            if (text) {
              if (td.getAttribute("data-label") !== text) td.setAttribute("data-label", text);
              td.removeAttribute("data-label-empty");
            } else {
              td.removeAttribute("data-label");
              td.setAttribute("data-label-empty", "");
            }
          });
        });
      });
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(label);
    };

    schedule();
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
