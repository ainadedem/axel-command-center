# Show first names in the quotations table sales chips

The Owner column already shows first names. The full names still visible in the quotations rows come from the green/blue sales chips (Acquisition and Closer) rendered per row.

## What changes

- In the quotations table rows, the Acquisition and Closer chips show only the first name, with the full name on hover.
- Everywhere else these chips appear (detail panel, pipeline, dialogs) keeps the full name.

## Technical notes

- `src/components/quote-sales-roles.tsx`: add an optional `firstNameOnly` prop; when set, render `firstName(value)` from `src/lib/person-name.ts` and put the full value in `title`.
- `src/routes/_authenticated/quotations.tsx`: pass `firstNameOnly` only at the table-row call site (around line 655), not the detail panel.
- No data, query, or stored value changes.
- Verify in the browser that the quotations rows show first names with full-name tooltips.
