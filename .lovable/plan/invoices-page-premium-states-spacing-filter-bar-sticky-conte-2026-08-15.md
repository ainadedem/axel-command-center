# Invoices page — premium states, spacing, filter bar, sticky context

Four related refinements to the invoices list. No data, RLS, numbering, or export logic changes.

## 1. Premium empty and error states

Today the page shows a single dashed box ("No invoices yet") whenever the list is empty, whether that's a fresh workspace, a filter that matched nothing, or a backend failure. Split it into three distinct states, built as one shared `ListState` component so other list pages can reuse it:

- **No invoices yet** — icon, short line, primary "New invoice" CTA (current behaviour, restyled to the card look used elsewhere).
- **No matches** — shown when filters/search/chips are active but nothing matched. Lists the active filters as removable chips, plus "Clear all filters" and a secondary "New invoice".
- **Couldn't load invoices** — shown when the workspace bootstrap reported a failure (`bootstrapError` from the company context). Explains in plain language, offers "Try again" (re-runs hydration) and keeps the page usable.

The KPI cards and aging panel stay hidden in the empty/error states, but the header and filter bar remain so the user can adjust filters without a reload.

## 2. Table row and column spacing

- Normalise cell padding so every column uses one horizontal rhythm; align numeric columns on a shared right edge with tabular figures.
- Give the header row and body rows matching padding so column labels sit exactly over their values.
- Reserve a small left gutter on rows so the floating action pill overlaps empty space instead of the checkbox/first column, and lift the pill above selected/hovered row backgrounds with a matching surface and shadow so it never looks clipped.
- Keep the current compact row height; only the alignment and pill layering change.

## 3. Filter bar consistency

- Put every control on a single 32px height baseline (search, Sort, Group, Filter, presets, Clear all) with consistent chip radii.
- Group visually: search and view controls | presets | clear, separated by thin dividers instead of ad-hoc spacing.
- "Clear all" becomes the single reliable reset: clears search, sort, group, all field filters, status chips, PO chips, the aging bucket selection, and deselects any active preset. It appears whenever any of those is set (currently it can miss preset/bucket state).
- Show a one-line summary of what's currently filtering the list when anything is active.

## 4. Sticky headers and filter card

- The filter card sticks below the app top bar while scrolling, with a subtle elevation once the page scrolls.
- The table header row sticks under the filter card so column labels stay visible on long lists.
- Group header rows stick just below the table header when grouping is on.
- Disabled on mobile stacked-card layout, where sticky offsets would eat the small viewport.

## Technical notes

- New shared component `src/components/list-state.tsx` (empty / no-match / error variants); `EmptyState` in `crud-toolbar.tsx` delegates to it so other pages are unaffected.
- Error state reads `bootstrapError` and the refresh action already exposed by `src/lib/company-context.tsx`.
- Sticky offsets driven by a CSS variable so the filter card and `thead` stay in sync; rules live in `src/styles.css` next to the existing `.stacked-table` block.
- Row/pill spacing changes are in `src/styles.css` and `src/components/list-table.tsx`; filter-bar layout in `src/routes/_authenticated/invoices.tsx`, `src/components/data-toolbar.tsx`, `src/components/filter-presets.tsx`, `src/components/status-filter-bar.tsx`.
- Once approved for Invoices, the same pattern can be applied to Quotations and Expenses in a follow-up.
