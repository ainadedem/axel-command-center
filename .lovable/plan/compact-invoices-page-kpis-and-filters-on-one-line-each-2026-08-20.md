# Compact invoices page — KPIs and filters on one line each

The invoices page still takes too much vertical space before the table: three full-size KPI cards, then the aging panel, then a multi-row toolbar. Collapse the KPI numbers into a single compact line and the filters into a single line so the table starts much higher.

## What changes

### 1. KPIs → one compact inline stat strip
Replace the 3-card `grid grid-cols-3` block (`src/routes/_authenticated/invoices.tsx` lines 629–633) with a single horizontal stat strip: one row of compact stat chips — `Open receivables · 78.7M Ar`, `Overdue · 78.7M Ar`, `Collected · 398.4M Ar` — small label + value inline, no card padding, no big metric font, no sheen/hover-lift. Wrap to a 2nd line only on narrow screens.

Build it as a tiny inline `StatStrip` (or a `flex flex-wrap items-center gap-x-6 gap-y-1` row with `text-sm font-tnum` values and `text-[11px] text-muted-foreground` labels), scoped to this page — do not change `KpiCard` itself (other pages use it). Keep the count-up animation optional; a plain `FlashOnChange` is fine here.

### 2. Filters → one single line
Collapse the unified toolbar (`invoices.tsx` lines 668–742) from three rows into one:
- Row 1 today: count label + `DataToolbar` + `FilterPresetBar` + right-aligned actions (Clear all, Export, Columns, Reconcile, Compact, New invoice).
- Row 2 today: `StatusFilterBar` (status + PO chips).
- Row 3 today: "Showing N of M" summary.

Merge them: keep the count label + `DataToolbar` + `FilterPresetBar` + status/PO chips + actions all on one wrapping row. Drop the dedicated second `StatusFilterBar` row and the standalone summary `<p>` — fold the "Showing N of M · filtered" summary into the leading count label (already partially there as `N invoices · filtered`) so it reads in-line. Keep `Clear all` next to the chips when filters are active.

Everything still wraps gracefully on narrow screens (`flex flex-wrap`), but on desktop it is one line.

### 3. Aging panel
Leave the `AgingPanel` as-is for now (it is collapsible already and the user's ask targets KPIs + filters). If the one-line changes leave the aging panel visually heavy, it can be defaulted to collapsed in a follow-up — not in this change.

## Out of scope
No data, RLS, numbering, filter logic, or export changes. `KpiCard`, `StatusFilterBar`, `DataToolbar`, `FilterPresetBar` component APIs are untouched; only how they are arranged in `invoices.tsx` changes.

## Technical notes
- All edits in `src/routes/_authenticated/invoices.tsx` `Body` return JSX (lines ~629–742).
- `StatStrip` can be a local component at the top of the file or inline JSX — keep it in this file.
- Verification: Playwright pass at 1573px confirming KPIs render as one compact line, the toolbar is one line, status/PO chips still filter, "Clear all" still resets, and no console errors.
