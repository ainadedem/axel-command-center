# Move invoice filters into the table toolbar

## Goal
The invoices page separates its filters (search/sort/group, filter presets, status & PO chips, "Clear all") into a standalone card that floats above the KPI cards and aging panel, disconnected from the table itself. Move those filter controls so they live **on the table** — as a single unified toolbar that caps the table panel — so filtering and the data it controls are one continuous surface.

## Current structure (`src/routes/_authenticated/invoices.tsx`, `Body`)
```
1. Page action row        — count + Export / Columns / Reconcile / Compact / New   (606–636)
2. Filter card            — DataToolbar, FilterPresetBar, Clear all, StatusFilterBar, chips summary  (638–685)  ← MOVE THIS
3. KPI cards              (702–706)
4. AgingPanel             (708–738)
5. ListTableShell (table) (741–813)
```

## Change

### 1. Remove the standalone filter card
Delete the `<div ref={filterRef} className="filter-sticky …">…</div>` block (lines 638–685) from its current position above the KPI cards.

### 2. Add a unified table toolbar directly above `ListTableShell`
Insert a single toolbar `<div>` immediately before `<ListTableShell>` (before line 741). It holds, in one row that wraps on small screens:
- **Left/primary:** `DataToolbar` (search/sort/group/filter) + `FilterPresetBar`
- **Right/secondary:** the existing page-action controls that belong to the table — `TableExportMenu`, `ColumnPicker`, `ReconcileButton`, compact-number toggle, `New invoice` button — moved down from the old page action row (606–636) so the table owns its own controls.
- The status & PO `StatusFilterBar` chips row underneath the primary row (same as today, just relocated).
- The `activeChips.length > 0` summary line ("Showing N of M invoices · …") stays with it.
- A "Clear all" pill shown when `filtersActive`.

Keep the invoice-count label (`N invoices · filtered`) at the start of the toolbar so the count still surfaces.

### 3. KPI + Aging stay above the toolbar
New order:
```
1. KPI cards
2. AgingPanel
3. Unified table toolbar (filters + table actions)   ← was filter card + page-action row
4. ListTableShell (table)
```
KPI/Aging are summaries of the *filtered* set, so keeping them above the toolbar is fine; they already read from `chipFiltered`/`aging` which are unaffected.

### 4. Sticky-header math
The `filterRef` + `ResizeObserver` block (lines 544–556) currently sets `--list-sticky-top` to the filter-card height so the table header parks under the pinned filter card.
- Move `filterRef` onto the new unified toolbar (now directly above the table).
- The toolbar no longer pins to the page top (it sits after KPI/Aging), so **remove the `filter-sticky` class** from the toolbar div. Instead keep the table's internal scroll pane (`sticky-head` + `maxHeight`) so the header sticks inside the pane as it does today.
- Recompute `--list-sticky-top` from the new toolbar height so the `maxHeight` calc still leaves room for the toolbar + KPI strip; if the toolbar scrolls out of view before the pane, fall back to a small constant (the pane header sticks within the pane regardless).

### 5. CSS
In `src/styles.css` (`.filter-sticky`, lines 1119–1126): leave the rule as-is (other pages may still use it) but do **not** apply the class to the invoices toolbar. No other CSS changes expected.

## Scope
- `src/routes/_authenticated/invoices.tsx` — restructure `Body` return JSX; move `filterRef`.
- No data/logic changes: `chipStatuses`, `chipPo`, `view`, `presets`, `activeChips`, `filtersActive`, `clearAllFilters` are reused unchanged.
- No new components, no prop signature changes.

## Verify
- `bunx tsgo` typecheck clean.
- Preview invoices page: filters render as a cap on the table; status/PO chips still filter; "Clear all" resets; sticky table header still parks correctly; KPI/Aging still update with the filtered set; no layout shift on the count.
