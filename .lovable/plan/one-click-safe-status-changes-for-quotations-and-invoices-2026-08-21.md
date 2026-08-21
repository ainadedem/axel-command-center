# One-click, safe status changes for quotations and invoices

Status changes become a first-class action: pickable from board cards, applicable in bulk, reason-gated on cancellation, and safe when two people act at once.

## 1. Status picker on Kanban cards

- Put the existing status picker (badge + dropdown) directly on quotation and invoice board cards, so a status can be changed without opening the card or the edit form.
- Full keyboard support: the badge is a real focusable button, Enter/Space opens the menu, arrow keys move between statuses, Enter selects, Esc closes; the card keeps focus after the change.
- Guarded transitions still open their dialog: "Paid" with an outstanding balance opens Mark Paid, "Cancelled" opens the reason dialog.
- Users without write access on that document see a plain badge with a "why not" tooltip instead of a picker.

## 2. Bulk status change from the list

- The selection bar on Quotations and Invoices gets a "Change status" action: pick a target status once, apply to every selected document.
- Before applying, a summary shows how many documents will change, how many are already in that status, and how many will be skipped (no permission, or needs a payment/reason).
- Cancelling in bulk requires one reason that is stored on every cancelled document.
- Every batch runs through a permission and validity check on the server, not just in the browser; documents the user may not touch are rejected there and reported back by number.
- A single Undo restores all documents changed by that batch (statuses, paid amounts, cancellation fields), and the undo itself is recorded in the audit trail.

## 3. Mandatory cancellation reason

- Quotations gain a "Cancelled" status (alongside Draft/Sent/Accepted/Rejected/Expired), with the same behaviour invoices have today.
- Moving a quotation or invoice to Cancelled always opens a dialog that requires a reason (free text, short presets offered: Client withdrew, Duplicate, Superseded, Pricing error, Project cancelled).
- The reason, who cancelled, and when are saved on the document and written into the audit trail and activity timeline; the reason shows in the status tooltip and detail panel.
- Leaving Cancelled clears the cancellation fields and logs that too.

## 4. Safe concurrent updates

- Changes apply optimistically so the UI feels instant.
- Before the write lands, the current status and last-modified stamp are checked against the database. If someone else changed it first, the write is rejected, the card/row snaps back to the real value, and a toast says who changed it and to what, with a Retry that re-applies your intent to the fresh value.
- In bulk, conflicting documents are reported individually — the rest of the batch still succeeds.
- Success, partial-success, conflict, and permission-denied each get a distinct, specific toast; nothing fails silently.

## Technical notes

- Migration: add `cancelled_at` and `cancellation_reason` to `public.quotes` (invoices already have them); allow `cancelled` in quote status handling. No other columns touched.
- Concurrency: server-side conditional update matching the document's `updated_at`/current status; mismatch returns a conflict record with the winning value instead of writing.
- New `src/lib/status-change.functions.ts` (server function, `requireSupabaseAuth`) handles single and bulk status writes: company-scoped role check, validity check, conditional update, audit rows. Client helpers `quote-status.ts` and `invoice-status.ts` call it and keep the optimistic/rollback logic.
- Reuse `StatusMenu`, `planStatusChange`, `logActivity`, `logBoardMove`, `notify`, and the existing bulk selection bar; add a shared `CancelReasonDialog` and a `BulkStatusDialog`.
- Extend the permissions tests with cross-company cases for bulk status changes, plus unit tests for the conflict planner and cancellation validation.
