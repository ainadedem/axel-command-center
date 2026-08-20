# Invoice toolbar — fully icon-only, hover labels, grouped contrast

## Goal
Collapse the entire invoice-page unified toolbar into icon-only controls whose names appear on hover (Radix Tooltip), with **one exception**: the "New invoice" button stays a full primary button (icon + label). The action cluster gets a subtle contrasting surface pill so filters and actions read as two distinct groups.

## Scope (confirmed)
- **Everything icon-only**: filter chips, count, presets, sort/group/filter, and action buttons all become icon-only with text-on-hover.
- **New invoice** stays full (icon + "New invoice").
- **Search** is the one functional exception: it stays a compact input, but collapses to a Search icon that expands on click (popover/inline) so the row reads as icon-only at rest.
- **Group contrast**: action cluster sits in a faint `surface-container` pill with a thin divider before it; filter chips stay on the default card surface.

## Components to change (add opt-in `iconOnly` props — no default change, other pages unaffected)

1. `src/components/data-toolbar.tsx` — `DataToolbar`
   - Add `iconOnly?: boolean`.
   - When true: Sort, Group, Filter become square ghost icon buttons (`h-8 w-8 p-0`) each wrapped in `<Tooltip>` showing its label ("Sort", "Group by", "Filters") + active-count badge. Search becomes a Search icon button that opens a small popover containing the input; typing applies the filter live. Keep all current logic (active states, counts).

2. `src/components/filter-presets.tsx` — `FilterPresetBar`
   - Add `iconOnly?: boolean`.
   - When true: collapse to a single `Bookmark` icon button (badge = active preset count). Click opens the existing preset list popover (select / rename / save). Hover label "Filter presets".

3. `src/components/status-badge.tsx` — `StatusFilterBar` (and PO chips)
   - Add `iconOnly?: boolean`.
   - When true: each status chip renders as a colored **icon + count badge only** (tone from `STATUS_META`), label revealed via Tooltip on hover ("Draft · 12"). PO chips (PO / PO bypassed / PO missing) render as icon + count with hover labels. "Clear all" becomes an `X` icon button, hover "Clear all filters".

4. `src/components/table-export-menu.tsx` — `TableExportMenu`
   - Add `iconOnly?: boolean`. When true: trigger becomes square `Download` icon button with hover "Export". Menu contents unchanged.

5. `src/components/list-table.tsx` — `ColumnPicker`
   - Add `iconOnly?: boolean`. When true: trigger becomes square `Columns3` icon button with hover "Columns". Popover unchanged.

6. `src/components/reconcile-button.tsx` — `ReconcileButton`
   - Add `iconOnly?: boolean` (and accept `className`). When true: square `ScanSearch` icon button (keeps the issue badge), hover "Scan for data inconsistencies".

7. `src/routes/_authenticated/invoices.tsx`
   - Wrap the whole toolbar inner in one `<TooltipProvider delayDuration={150}>`.
   - **Count** ("44 of 44 invoices · filtered") → a `Hash`/`ListFilter` icon button with a tiny count number; hover tooltip shows the full "44 of 44 invoices · filtered" text.
   - Pass `iconOnly` to `DataToolbar`, `FilterPresetBar`, `StatusFilterBar`, `TableExportMenu`, `ColumnPicker`, `ReconcileButton`.
   - Compact/Full number toggle → square icon button (`ToggleLeft`/`ToggleRight`), hover "Compact numbers" / "Full numbers".
   - Action cluster (Export, Columns, Scan, Compact) wrapped in `<div className="ml-auto flex items-center gap-1 rounded-full bg-[var(--surface-container)]/70 p-1">` — the subtle surface pill.
   - Thin divider before the pill.
   - "New invoice" button unchanged (full primary).

## Hover-label mechanic
Use the existing `@/components/ui/tooltip` (`Tooltip` / `TooltipTrigger` / `TooltipContent`) inside one `TooltipProvider`. Each icon button is a `TooltipTrigger asChild` pointing at a `TooltipContent` with the label. Native `title` retained as a fallback for accessibility where a Tooltip can't wrap (e.g., trigger inside a Popover).

## Preserve
- All existing functionality: sorting, grouping, filtering, presets, column widths/order, status/PO counts, export, reconcile, compact toggle, and New invoice.
- Other routes that use these components keep current behavior (`iconOnly` defaults false).

## Verify
- Build passes.
- Open Invoices page: toolbar row is a single dense line of icon buttons (one full New invoice); hover each to see its name; counts/badges visible; pill separates actions from filters.
- Drive via Playwright: click Columns (popover opens), click a status chip (filter applies, count updates), type in expanded search (list filters), click New invoice (create dialog opens).
