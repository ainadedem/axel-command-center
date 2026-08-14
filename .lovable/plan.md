# Row action pills, drawer states, and aging deep links

Three related refinements to the table and aging experience.

## 1. Group row actions inside a rounded pill

Today the hover actions (history, preview, edit, delete) float as bare icons at the bottom-left of a row, with no container.

- Wrap the icon group in a single rounded container: pill radius, card background, hairline border, soft shadow, small internal padding and consistent gaps between icons.
- The strip reserved under each row already exists; it will be sized so the pill never overlaps the row below and the row height does not jump when the pill appears. Padding and spacing stay identical whether the pill is visible or hidden.
- Keep the current 150 ms reveal (fade + 2 px rise) and the icon hover/press motion; icons stay icon-only, no text.
- Touch devices keep the pill permanently visible; reduced-motion users get an instant reveal.

## 2. Polished loading and empty states

- Aging drawer: while the record list is resolving, show three shimmering skeleton cards that match the real card geometry (title line, subtitle line, right-aligned amount). When a bucket genuinely has no records, show a centered empty state with an icon, a short headline and one line of context, styled like the premium cards elsewhere.
- Row actions: while a row action is running (delete, refresh, export), the pill shows a spinner in place of that icon and disables the group, so a slow action never looks unresponsive.
- Both states respect reduced-motion (shimmer becomes a static tint).

## 3. Deep links from aging records to the row

Clicking a record in the aging drawer currently scrolls in-page only. It will become a real deep link.

- Jumping writes `?focus=<record id>&aging=<bucket>` to the URL, so the link can be copied, bookmarked or shared.
- Opening a URL that carries `aging=<bucket>` restores that bucket filter and re-opens the drawer automatically; `focus=<id>` scrolls the matching row into view and pulses its highlight ring.
- Quotations gets the same treatment as Invoices: search-param validation, per-row focus targets, and the scroll-and-highlight behaviour. Receivables/Payables keep their existing behaviour plus the new drawer restore.
- If the target row is filtered out or on another page of the list, the filter is relaxed for that record so the jump always lands.

## Technical notes

- `src/styles.css`: convert `.row-actions-inner` into a bordered pill (`--card` background, `--border` hairline, shadow token) with stable `padding-bottom` reservation on sibling cells.
- `src/components/aging-drawer.tsx`: add `loading` prop with skeleton cards, plus a designed empty state.
- `src/components/list-table.tsx`: `ListActions` accepts a `busy` flag to swap an icon for a spinner and disable the group.
- `src/components/aging-panel.tsx`: accept controlled `drawerBucket` / `onDrawerBucketChange` so routes can restore the drawer from search params.
- `src/hooks/use-focus-row.ts`: extend the search schema with `aging`; add a `jumpToRecord` helper that navigates with both params before calling `focusRowById`.
- `src/routes/_authenticated/invoices.tsx`, `expenses.tsx`, `quotations.tsx`: wire the new search params, drawer restore, and `data-focus-id` on quotation rows.

No database or backend changes.
