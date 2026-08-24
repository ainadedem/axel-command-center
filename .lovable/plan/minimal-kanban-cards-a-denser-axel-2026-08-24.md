# Minimal Kanban cards + a denser Axel

Two connected changes: shrink the board cards to the essentials, and tighten the whole app so more information fits on one screen. No data, permission, or business-logic changes.

## 1. Minimal Kanban cards

Today each card stacks number, client, subject, role chips, doc chips, a divider, amount, date, plus an action row — roughly 130px tall.

The new card is a two-line block, about half the height:

- Line 1: client name (medium weight, truncated) with the client colour still as the left accent bar, and the company as a tiny colour dot on the right.
- Line 2: amount in tabular figures, then compact icon signals instead of text — calendar icon + short date (red when overdue/expiring), a person icon with the assignee initial, a message icon with the comment count, a paperclip/doc icon when linked quotes/POs exist. Icons only appear when they carry information, each with a tooltip and an aria-label.
- Document number moves into the tooltip/aria-label of the card, no longer taking its own line. Subject, role names, and the divider are dropped from the card face.
- Status stays implied by the column, so no status chip on the card.

Details on click:
- Clicking a card keeps opening the existing detail (detail panel / editor) — unchanged.
- The hover/focus action row is replaced by a single overflow (…) button in the card's top-right that opens a menu with the current actions: Open, Change status, Assign to me, Mark as paid (invoices), Comment. On touch the button is always visible. This removes the permanent action strip from the card height.
- Comment stays an inline popover from that menu, same behaviour as now.

Pipeline cards get the same treatment: name + client on line 1, value + urgency icon and the doc-chip roll-up collapsed into icon+count on line 2, edit/delete inside the overflow menu.

Board chrome also tightens: shorter column headers, smaller gaps, tighter card spacing, so more cards are visible per column without scrolling.

## 2. Space-saving pass across Axel

A single density scale applied through shared components, plus a Compact/Comfortable toggle in Settings (default Compact) remembered per user:

- Rows and tables: smaller row height and cell padding, quieter separators, sticky headers kept.
- Page headers: title, breadcrumb, and actions collapse onto one line; the filter pill row sits directly under it with less vertical padding.
- KPI blocks: smaller figures and padding, so a KPI strip takes noticeably less height; they stay in one row longer before wrapping.
- Panels: reduced internal padding and gaps between panels, so more content fits inside the same canvas.
- Detail panels and dialogs: tighter field spacing and section gaps.
- Typography: one step down on secondary/metadata text, body text unchanged for readability; numeric columns keep tabular figures.

Accessibility is preserved: hit targets stay at least 32px in compact mode (44px on touch), contrast unchanged, all icon-only controls keep labels and tooltips, and motion still respects reduced-motion.

## Technical notes

- `src/components/kanban-board.tsx`: replace the `renderActions` strip with an optional `renderMenu` slot rendered as an overflow button in the card corner; reduce card padding, gaps, and column paddings.
- New `src/components/card-signals.tsx`: small icon+value primitives (date, assignee, comments, links) used by all three boards.
- `quotations.tsx`, `invoices.tsx`, `pipeline.tsx`: rewrite only their `renderCard`/actions to the new shape, reusing the existing `StatusMenu`, `CardCommentAction`, mark-paid and assign handlers.
- Density lives in `src/styles.css` as spacing/size tokens switched by a `data-density="compact"` attribute on the app shell, with the preference stored via the existing `usePersistentState` pattern; shared components read the tokens instead of hardcoded padding.
- No route, hook, store, RLS, export, or PDF changes.

## Acceptance checks

- Board cards are roughly half their current height and show client, amount, and icon signals only.
- Every previous card action is reachable from the card's overflow menu, with the same permission rules and messages.
- Compact is the default; the toggle switches the whole app without layout breakage on mobile.
- Screenshots of `/quotations`, `/invoices`, `/pipeline`, and the dashboard show more rows/cards per viewport than today.
