# Fix the SOP ladder colours and link every flag to its document

## What's wrong today

The Day 15 / 30 / 45 / 60 buttons already have red and green styling, but nothing ever turns green because logged actions can silently fail to save:

- A new log entry gets a local id like `esc-ab12`, which is not a database id. The save path drops it, the database creates its own id, and the local record keeps the old one — so the same action can be written twice and the local list can drift from the saved one.
- If the invoice or company cannot be written to, the save quietly returns nothing. No error is shown, the dialog closes, and the step looks like it was never logged.
- The button state is computed from "a log exists", not from the saved timestamp, so a step logged in the past is indistinguishable from one just clicked and never persisted.

Separately, every row in the Compliance checklist shows a reference (invoice number, PO number, expense payee) as plain text — there is no way to jump to the actual document.

## What will change

### 1. Ladder steps driven by the saved timestamp

- Each step reads the most recent saved log for that invoice and stage and uses its `performed_at` date.
- Colours: green when a saved timestamp exists (tooltip shows the date and who did it), red when the step is due and has no saved timestamp, muted grey when not yet due.
- Clicking a green step opens a read-only view of what was recorded, with the option to edit or remove it, so a mistake can be undone and the step returns to red.
- The row shows the date of the latest logged step next to the age, so progress is visible without hovering.

### 2. Logging actually confirms

- Saving waits for the database to confirm, adopts the id it returns, and shows a success toast.
- If the save is rejected (no write permission on that company, or the invoice is only local), the dialog stays open and shows the real reason instead of closing silently.

### 3. Every warning links to its document

- The Reference cell in the Compliance checklist becomes a link that opens the right page with that record highlighted:
  - invoice flags → Invoices
  - purchase order flags → Purchase Orders
  - expense / payables flags → Expenses
- A new Client column is added, resolved from the record, and links to the Clients page for that client.
- The AR escalations tab gets the same treatment: invoice number and client name become links.
- Landing on a page with a highlighted record scrolls it into view and briefly rings it, so it is obvious which row was meant.

## Technical notes

- `src/lib/sop.ts`: extend `Violation` with `clientId` and keep the existing `entity` / `entityId` so the UI can route without re-deriving.
- `src/routes/_authenticated/sops.tsx`: rewrite the ladder cell to build a `Map<stage, InvoiceEscalation>` (latest by `performedAt`) instead of a `Set<stage>`; add view/edit/delete for a logged step; add link cells.
- `src/lib/db-sync.ts`: `upsertInvoiceEscalation` returns the persisted id and errors; the caller writes the id back into the store and surfaces failures. No schema change is required — `invoice_escalations` already stores `performed_at`.
- `src/routes/_authenticated/{invoices,purchase-orders,expenses,clients}.tsx`: add a `focus` search param (`validateSearch`) plus a small scroll-and-highlight effect. No change to list logic or data access.
