# Bulk edit: client & project on quotations and invoices

Let you select several invoices or quotations at once and reassign their **client** and/or **project** in one action.

## What you'll see

- A checkbox column at the left of the invoices and quotations tables, plus a "select all" checkbox in the header (selects only the rows currently visible after filters/search).
- When at least one row is selected, a floating action bar appears at the bottom: "N selected · Edit client/project · Clear".
- The bulk edit dialog has two optional fields:
  - **Client** — leave as "Keep current" or pick a new client.
  - **Project** — "Keep current", "Clear project", or pick a project (list filtered to the chosen/most common client and company).
- Confirming shows a summary ("Update 7 invoices?"), applies the change, and shows a toast. The existing undo system reverses the whole batch in one step.

## Rules and safeguards

- Only rows in companies you can write to are selectable; rows from read-only companies show a disabled checkbox.
- Cancelled/paid invoices can still be re-linked (client/project only, no amounts change), but cancelled ones are flagged in the confirm summary.
- Sales-only users can bulk edit their own quotations only; invoices bulk edit stays hidden for them (same visibility rules as today).
- Each change writes the standard "last updated by / at" fields and an activity entry per document, so the timeline stays accurate.
- Selection resets when the company, filters, or page change.

## Technical notes

- New shared component `src/components/bulk-select.tsx` (selection state hook + floating bulk bar) and `src/components/bulk-edit-doc-dialog.tsx` (client/project picker, mode = keep / set / clear).
- `src/routes/_authenticated/invoices.tsx` and `quotations.tsx`: add checkbox `<th>/<td>`, wire `useBulkSelection(visibleRows)`, render the bar and dialog. Column spans on group header rows bumped by one.
- Apply loop uses existing `invoicesStore.update` / `quotesStore.update` so Supabase sync, RLS error reporting (`reportWriteError`) and history recording run unchanged; the batch is wrapped in a single history transaction so one undo reverts all rows.
- Activity entries via existing `src/lib/document-activity.ts` helper, action `bulk_update`.
- No schema changes, no new tables.
