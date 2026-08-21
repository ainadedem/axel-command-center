# Fix month grouping order

## Problem (confirmed)

Grouping invoices/lists by "Issued (month)" (and "Issued (day)") produces groups ordered alphabetically by their display text — "Apr 2026", "Aug 2026", "Dec 2025", "Feb 2026" — instead of chronologically. The grouping code sorts groups by the label string, and the month field's value is a formatted label like `MMM yyyy`, so the order looks scrambled. These date-bucket fields are also currently not sortable at all as table columns.

## What to change

1. **Separate the group's sort value from its label.** Give each field an optional sort key used only for ordering (for months: `2026-04`; for days: the ISO date; for quarters: `2026-Q2`), while the visible label stays "Apr 2026". Groups then always appear in true chronological order (newest-first for date buckets, matching how invoices are read).
2. **Apply it to every date bucket** on invoices — day, month, quarter — and to the same bucket fields wherever else they exist (quotations, purchase orders, projects, clients) so behaviour is consistent across lists.
3. **Allow sorting on those columns** so clicking the "Issued (month)" header sorts chronologically rather than being disabled.

## Technical notes

- `src/hooks/use-data-view.ts`: add an optional `sortAccessor` (and `groupKey`) to `FieldDef`; use it in both the sort comparator and the group ordering (`.sort(([a],[b]) => ...)` currently compares display strings). Keep the label from the normal accessor.
- `src/routes/_authenticated/invoices.tsx` (lines ~171-196): define `issuedDay` / `issuedMonth` / `issuedQuarter` with a `sortAccessor` returning an ISO-sortable key, and drop `noSort: true`.
- Audit sibling routes that build `FieldDef` lists with formatted date buckets and give them the same treatment.
- No database or business-logic changes; display and ordering only.
