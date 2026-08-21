# Kanban templates, move audit trail, and card quick actions

## Answer first: are quotation column sizes editable?

Yes, in both places:
- The quotations **list table**: drag the edge of any header to resize, drag headers to reorder, hide/show from the column menu. Widths are saved per user, per page (Reset widths / Reset order in the same menu). Keyboard: Shift + Left/Right resizes the focused header.
- The quotation/invoice **document preview**: line-table column widths are adjustable in the preview controls, together with the fit-to-one-page toggle.

No change needed there — the rest of this plan is the new work.

## 1. Kanban column templates

Add a template picker above the board on Quotations and Invoices.

- Built-in templates:
  - Quotations — "Sales flow" (Draft, Sent, Accepted, Rejected, Expired), "Focus" (Draft, Sent, Accepted).
  - Invoices — "Sales flow" (Draft, Sent, Paid), "Collections" (Sent, Partly paid, Overdue, Paid), "Full" (all six).
- One click switches the visible columns and their order; the choice is remembered per user and per page.
- "Save current as template…" captures the visible columns and order under a name; saved templates can be renamed and deleted.
- Cards whose status is not part of the active template are simply not shown on the board (count shown as "N hidden by this template", one click to switch to the full template).

## 2. Move audit trail

- Every board move on quotations and invoices is recorded: who moved it, from column, to column, timestamp — including moves that are rejected by permission or by the payment/cancellation rules (recorded as blocked, so the trail explains gaps).
- New "Board history" panel opens from the board toolbar: reverse-chronological list of moves for the currently filtered documents, with document number, from → to badges, actor name and relative time, and a link to open the document.
- Each document's existing activity timeline also shows these moves, so the per-document history stays the single source of truth.

## 3. Quick actions on cards

A small action row appears on card hover / focus (and is always visible on touch):

- **Open** — opens the document detail as today.
- **Mark as paid** (invoices) — opens the existing Mark paid dialog inline over the board, keeping the payment-proof and audit rules.
- **Assign to me** — quotations use the existing up-to-3 assignee list; invoices get the same assignee capability.
- **Comment** — opens a quick note box on the card; for quotations it writes a follow-up entry, for invoices it writes a note into the document activity trail. The card shows a small comment count badge.

All actions respect the current role rules (sales can only touch their own quotations; payment actions stay finance/admin only) and show a clear permission message when blocked.

## Technical notes

- `src/components/kanban-board.tsx` gains an optional per-card action slot and accepts a filtered/ordered column list; no new drag dependency.
- Templates live in a new `src/lib/kanban-templates.ts` using the existing `usePersistentState` per-user pattern, mirroring `useTablePrefs` semantics.
- Moves log through `logActivity` (`status_changed`, plus a `blocked` detail flag) in `src/lib/document-activity.ts`; the Board history panel reads `document_activity` filtered by `doc_type` + company.
- Invoice moves keep routing through `planStatusChange` / `commitStatusChange` in `src/lib/invoice-status.ts`; quote moves keep the optimistic update + undo toast.
- One migration on `public.invoices` only: add `assigned_to uuid[] not null default '{}'` (mirrors `quotes.assigned_to`); no other table or column touched.
