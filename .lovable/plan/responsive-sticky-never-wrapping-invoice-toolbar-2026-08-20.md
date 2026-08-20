# Responsive, sticky, never-wrapping invoice toolbar

Goal: the invoice filter toolbar stays one line at any width, sticks to the top while the table scrolls, and every compact chip explains itself on hover.

## What changes

### 1. Single-line toolbar with an overflow menu
Today the toolbar is a `flex flex-wrap` row: at narrow widths the status and PO chips wrap onto extra rows and push the table down.

- Measure the toolbar width and how many chips fit; chips that don't fit move into a single "More filters" overflow button (with a count badge for active hidden filters).
- Inside the overflow dropdown, each hidden status / PO chip renders as a full labelled row with its count, so nothing becomes unreachable.
- The action cluster (Export, Columns, Reconcile, number-format toggle) and the "New invoice" button always stay visible and never overflow.

### 2. Smaller-screen behaviour
- Below the mobile breakpoint the toolbar collapses to one horizontal chip row: count pill, search, a single "Filters" button (sort, group, filters, presets, statuses, PO in one sheet), then the action cluster and a compact icon-only "New" button.
- The row scrolls horizontally rather than wrapping, so it stays exactly one line tall.

### 3. Sticky toolbar
- The toolbar card becomes sticky at the top of the scroll area while the invoice table scrolls under it, with a slight elevation/blur once stuck.
- Keeps the existing measured `--list-sticky-top` so the table's sticky header sits directly below the toolbar and neither overlaps.

### 4. Tooltips and full labels
- Replace the current native `title` attributes on compact chips with real tooltips showing label, meaning, and count (e.g. "Overdue — past due date · 12").
- Tooltips also cover sort/group/filter/preset/export/columns/reconcile triggers, with matching `aria-label`s for screen readers.

## Technical notes

- Files: `src/routes/_authenticated/invoices.tsx` (toolbar container, sticky wrapper, mobile branch), `src/components/status-filter-bar.tsx` (overflow-aware chip rendering + tooltips), `src/components/data-toolbar.tsx` and `src/components/filter-presets.tsx` (tooltip pass).
- Overflow detection via a `ResizeObserver` on the toolbar plus per-chip width measurement, in a small reusable `useOverflowItems` hook so quotations/POs can adopt it later.
- Tooltips use the existing shadcn `Tooltip` primitive; because several triggers are already `PopoverTrigger asChild`, wrap the trigger element rather than nesting `asChild` twice.
- Mobile branch keyed off the existing `useIsMobile` hook.
- Sticky uses `position: sticky; top: 0` on the toolbar card inside the page scroll container; the existing `ResizeObserver` that sets `--list-sticky-top` stays, so the table header offset remains correct.
- No data, filtering, or business logic changes — presentation only.
