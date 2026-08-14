# Denser rows and icon-only status chips

Two changes to the list tables (invoices, quotations, purchase orders and every other page using the shared table).

## 1. Tighter rows, overlapping action pill

Today each row reserves a ~36px empty strip at the bottom so the floating action pill has its own space. That strip is the main reason only a few rows fit per screen.

- Cut the cell padding from 12px to 6px top/bottom, so rows are visibly shorter and more fit per page.
- Remove the reserved bottom strip entirely. The rounded action pill now floats over the bottom-left of the hovered row instead of pushing content down.
- Because it overlaps, the pill gets a slightly stronger shadow and a solid card background so the text underneath stays readable, and it keeps its current fade + lift animation and padding.
- Row height stays identical whether or not the pill is shown — no jumping on hover.
- On mobile (stacked cards) nothing changes: the actions stay as a card footer.

## 2. Status and PO chips: icon only, label on hover

- The status chip and the PO chip become a compact colored circle with just the icon, keeping their existing color coding (green paid, red overdue, amber partial, etc.).
- On hover or keyboard focus, the label slides open next to the icon with the same 150ms motion used everywhere else, then collapses again.
- Screen readers and tooltips still get the full label, so nothing is lost for accessibility.
- This keeps each record on a single line even in narrow columns.

## Technical notes

- `src/styles.css`: reduce `.stacked-table` cell padding, drop the `padding-bottom: 2.25rem` reservation on rows with a `row-actions-cell`, raise the pill z-index/shadow. Add a `.status-chip` utility with a `grid-template-columns: 0fr → 1fr` label reveal (same trick already used for row action labels), with a `prefers-reduced-motion` fallback that shows the icon only.
- `src/components/status-badge.tsx`: `StatusBadge` and `PoBadge` render icon + a hover-revealed label span; keep `aria-label` and `title` as they are. Add an optional `showLabel` prop for places that need the static full chip (filter bars, drawer), so `StatusFilterBar` and the aging drawer keep their text.
- Verify with a Playwright pass on `/invoices` and `/quotations`: row count per viewport increases, pill overlaps cleanly on hover, chips expand on hover.
