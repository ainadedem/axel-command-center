# Change statuses without opening the editor

Today a status change on a quotation or an invoice means opening the full edit dialog (the only status dropdown lives inside the form). The board view already allows drag-to-change, but the list and the detail panel do not. This adds a one-click status control everywhere a document is shown.

## What changes

**Clickable status badge**
- In the Quotations list, Invoices list, and both detail panels, the status badge becomes a small menu: click it, pick the new status, done.
- The menu lists only statuses that make sense for the document (quotations: Draft, Sent, Accepted, Rejected, Expired; invoices: Draft, Sent, Partial, Paid, Overdue, Cancelled) and marks the current one.
- Saves instantly with a toast and an **Undo** action; no dialog, no re-save of the rest of the document.
- Read-only users (no write permission on that document) see the plain badge with a "you cannot change this" tooltip instead of a menu.

**Guarded transitions keep their dialogs**
- Marking an invoice **Paid** while a balance remains still opens the Mark paid dialog; **Cancelled** still asks for a reason. The menu opens the right dialog instead of writing silently, exactly like the Kanban board does today.
- Invoices moving to **Sent** still respect the PO requirement (PO present or explicitly waived).

**Same rules as everywhere else**
- Every change is written to the document activity trail as a status change with actor and timestamp, and feeds the existing pipeline stage suggestions (quote sent / accepted / rejected, invoice paid).
- The edit dialog keeps its status field; nothing is removed.

**Also applied to**
- Purchase orders list gets the same clickable status badge, so the three document pages behave identically.

## Technical notes

- New shared `StatusMenu` component wrapping `StatusBadge` (dropdown-menu based, keyboard accessible), taking the allowed status list, current value, a `disabled` reason, and an `onSelect` handler.
- Quotation side: extract the status-change logic currently inline in the quote board (`quotesStore.update` + `logActivity` + `proposeStageChange`) into a small `applyQuoteStatus` helper in `src/lib/quote-status.ts`, then reuse it from the board, list, and detail panel so behaviour cannot drift.
- Invoice side: reuse the existing `planStatusChange` / `commitStatusChange` from `src/lib/invoice-status.ts`; when the plan reports `requiresPayment` or `requiresReason`, open `MarkPaidDialog` / the cancel dialog instead of committing.
- Optimistic store update plus the existing undo path (`committed.revert()`), so a rejected write rolls back like other instant edits.
