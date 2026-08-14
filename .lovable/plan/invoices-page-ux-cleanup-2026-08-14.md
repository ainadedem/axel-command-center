# Invoices page — UX cleanup

The page currently stacks five separate control strips before any data appears, so the table only starts about two thirds down the screen. Goal: one coherent header, one filter area, compact insights, table visible immediately.

## What's wrong today

- Four toolbar rows in a row: count + "New invoice", export/columns/scan/compact, search/sort/group/filter, preset bar, then status + PO chips. Controls of the same kind are split across rows.
- A second "New invoice" button duplicates the one already in the global top bar.
- "Save preset" sits alone on its own line, disabled-looking, with no context.
- The three KPI cards use inconsistent value sizes (Overdue renders smaller than the others).
- Aging appears twice at full height: a tiles panel and a chart panel, ~500px before the table.
- Chart Y-axis labels are clipped ("000000").

## The redesign

1. **Single page header row**
   - Left: title context (invoice count, active filter summary).
   - Right: one action cluster — Export, Columns, Scan, Compact toggle, then the primary "New invoice" button (remove the duplicate CrudToolbar button).

2. **One unified filter bar**
   - Row A: search field + Sort + Group + Filter + preset dropdown (presets become a select with "Save current" inside it, no orphan line).
   - Row B: status and PO chips, with a single "Clear all" that resets chips, search and filters.
   - Show an active-filter summary line only when something is applied.

3. **Compact insights**
   - KPI cards: same value type scale and tone treatment across all three.
   - Merge the aging tiles and aging chart into one collapsible "Receivables aging" card: tiles on top as the selector, chart below, collapsed state remembered per user. Fix Y-axis width so labels are not cut.

4. **Table first**
   - Above changes push the table roughly 400px up. Keep the sticky header, row action pill, and existing column prefs untouched.
   - Keep empty-state and bulk-action bar behaviour as-is.

## Technical notes

- Edits stay in `src/routes/_authenticated/invoices.tsx`, `src/components/filter-presets.tsx`, `src/components/aging-panel.tsx`, `src/components/kpi-card.tsx`, and small tweaks in `src/components/data-toolbar.tsx`.
- No data, RLS, numbering, or export-pipeline logic changes; filter/aging/table state hooks stay as they are.
- Collapsed-aging preference stored with the existing per-user table prefs mechanism.
- Once approved for Invoices, the same header/filter pattern can be applied to Quotations and Expenses in a follow-up.
