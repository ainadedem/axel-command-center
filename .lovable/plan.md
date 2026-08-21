# Kanban boards, customizable columns, cleaner names

## 1. Draggable Kanban — Pipeline

The Pipeline already has a Kanban view, but cards are static.

- Drag any deal card onto another stage column to change its stage; the column highlights while hovering and the card lands at the drop position.
- Saves immediately with optimistic update, a toast, and rollback if the write fails.
- Keyboard accessible: a card can be focused and moved between stages with arrow keys.
- Column headers keep live count, total value and weighted probability, refreshed on drop.
- Existing stage automation (quotation/invoice links, variance) keeps firing on the new stage.

## 2. Draggable Kanban — Quotations & Invoices

Add a Board view (toggle next to the existing list/table view) on both pages:

- Quotations grouped by status: Draft, Sent, Accepted, Rejected, Expired.
- Invoices grouped by status: Draft, Sent, Part-paid, Paid, Overdue, Cancelled.
- Dragging a card between columns changes the document status through the existing status-transition rules, so audit trail entries, "Mark paid" confirmation, and payment-proof checks still apply. Transitions the rules forbid (for example dropping straight into Paid without payment info) open the existing dialog instead of writing silently.
- Cards show object title, document number, client (respecting the display-name rule below), amount, and due/expiry badge.
- Board respects the current filters, search, company scope, and sales-role restrictions.

## 3. Customizable columns on all main list tables

Extend the existing column-settings behaviour (show/hide, drag to reorder, resize, per-user saved layout) to every main list table: Quotations, Invoices, Clients, Projects, Transactions, Purchase Orders, Accounts, Suppliers, Expenses, Team.

- Same settings menu on each page, with Reset widths and Reset order.
- Layouts stay per user and per page.

## 4. Names no longer cropped

- Quotation and invoice numbers/objects render in full: number columns never truncate, and the object title wraps to a second line instead of being cut mid-word.
- Default column widths for number and object columns increased so nothing clips at common screen sizes.

## 5. Client display name

- Add an optional **Display name** field to the client form.
- When it is set, tables, boards, pickers and dropdowns show only the display name; the full legal name is still used on invoices, quotations and other generated documents, and appears on hover.
- When it is empty, the full name is shown as today.

## Technical notes

- New `client.display_name` column via migration on the existing `clients` table only, plus grants unchanged; form and sync layers updated to carry the field.
- Kanban uses the project's existing HTML5 drag utilities (`src/components/sortable-row.tsx` pattern) — no new dependency.
- Status changes route through `src/lib/invoice-status.ts` and the pipeline stage helpers so audit logging and optimistic rollback stay intact.
- Column behaviour reuses `useTablePrefs` / `ColumnPicker`; each new table just declares its `ColumnDef[]` and default widths.
