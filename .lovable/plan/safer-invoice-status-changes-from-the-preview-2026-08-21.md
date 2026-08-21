# Safer invoice status changes from the preview

Status changes made from the invoice preview currently write only a few fields directly. This plan routes every status change through one controlled path with an audit trail, validation, immediate feedback, and undo.

## What you'll get

1. **Full audit trail** — every status change records who made it, the old and new status, the paid amount and cancellation fields before/after, and the exact timestamp. Visible in the existing document activity timeline on the invoice.
2. **No "Paid" without money** — marking an invoice Paid from the preview opens the existing Mark-paid flow (payment date + bank account), which sets the paid amount and creates the matching income transaction. No silent "paid but unpaid" invoices. If the invoice is already fully covered by recorded payments, it flips straight to Paid with no extra dialog.
3. **Cancellation stays complete** — a reason is required and the cancellation timestamp is stored; moving back out of Cancelled clears both.
4. **Instant feedback** — a success toast after each change, plus a short inline diff on the invoice row showing what moved (for example `Sent → Paid · paid 0 → 12 400 000 MGA`).
5. **Undo** — the toast carries an Undo action for 10 seconds that restores the previous status, paid amount, paid date and cancellation fields, and removes any payment transaction the change created.
6. **Automated consistency tests** — tests that assert the invoice KPIs (Open receivables, Overdue, Collected) and the row balance stay consistent for every status transition, including after undo.

## Technical approach

**New `src/lib/invoice-status.ts`** — single source of truth for status transitions:
- `planStatusChange(invoice, next, ctx)` returns a `{ patch, requiresPayment, requiresReason }` descriptor: sets `paid`/`paidDate` on paid, clears/sets `cancelledAt` + `cancellationReason`, derives `partial` correctly.
- `applyStatusChange(...)` executes the patch through `invoicesStore.update`, optionally adds the payment transaction via `transactionsStore`, writes the audit entry, and returns a `revert()` closure used by Undo.
- Pure helpers exported so tests can exercise them without React.

**`src/components/document-preview.tsx` / `invoice-preview.tsx`**
- Replace the inline `changeStatus` patch building with a callback into the new helper (the preview stays generic; invoice-specific behaviour lives in `invoice-preview.tsx`).
- `paid` selection with an outstanding balance opens the existing `MarkPaidDialog` instead of patching directly.
- Cancelled keeps the required-reason prompt, upgraded to a proper dialog.

**Audit trail** — uses the existing `document_activity` table via `logActivity`, with `action: "status_changed"` and a `details` payload of `{ before, after, paidBefore, paidAfter, paidDate, cancelledAt, cancellationReason, transactionId }`. No schema change needed; actor and timestamp are already recorded server-side.

**Toast, diff and undo** — `sonner` toast with an `action: { label: "Undo" }` and `duration: 10000`, calling the `revert()` closure (which runs inside `withoutHistory` so the global undo stack is not polluted twice). The inline row diff is a transient chip rendered in `src/routes/_authenticated/invoices.tsx`, keyed by invoice id, fading out after ~8s; it reuses the existing focus-row highlight mechanism so nothing shifts layout.

**Tests** — `src/lib/__tests__/invoice-status.test.ts` (Vitest):
- transitions draft/sent/overdue → paid/partial/cancelled and back;
- assert `invoicePayable`/`invoiceBalance` invariants and recomputed KPI totals (open, overdue, collected) match the recorded payments after each transition;
- assert `revert()` restores the exact prior field set and removes the created transaction.
Run with the existing `vitest run` script.
