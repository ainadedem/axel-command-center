# Show only first names in tables

Tables currently show full names (e.g. "Rakoto Jean Andrianina"), which eats horizontal space. Switch every table cell that shows a person to just the first name, while keeping full names everywhere the detail matters.

## What changes

- Owner / creator columns on Quotations, Invoices, Purchase Orders lists.
- Assignee avatar stacks and name chips shown inside list rows.
- Team and SOP list tables where a person's name is a column value.
- Board history and document activity rows (the actor line).

## What stays as full name

- Detail panels, dialogs, pickers and dropdowns (so you can tell two "Jean"s apart).
- Printed/exported PDF documents, invoice and quotation previews.
- Emails and notifications.

## Behaviour details

- First name = first whitespace-separated word of the display name.
- If the name comes from an email fallback (no display name), show the part before the "@" unchanged.
- Hover tooltip on the cell shows the full name, so nothing is lost.

## Technical notes

- Add a small `firstName(name)` helper in `src/lib/client-name.ts` (or a new `src/lib/person-name.ts`).
- Apply it at render time in the table cells only: `ownerName(...)` call sites in `invoices.tsx`, `quotations.tsx`, `purchase-orders.tsx`, `team.tsx`, `sops.tsx`, plus `AssigneeStack` labels in `quote-assignee-picker.tsx`, and the actor lines in `board-history-panel.tsx` / `document-activity-panel.tsx`.
- No data model, query, or stored value changes; `profiles.display_name` is untouched.
- Verify in the browser that the Quotations and Invoices owner columns render first names with full-name tooltips.
