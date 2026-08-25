# Guided experience, acceptance audit trail, and acceptance notifications

Three connected pieces: make Axel readable and directive for a non-finance user, record exactly what happened when a quotation acceptance spawns documents, and tell the right people about it with one-click links.

## 1. Make the app self-explanatory ("what is happening, what do I do next")

The building blocks already exist (conversion gap, weekly summary, SOP compliance, AR aging, notifications) but they are scattered and phrased for finance people. The plan is a guidance layer on top, not new business logic.

**a. "Run the business" home panel** — on the launcher (`/`) and dashboard, a single prioritised task list generated from live data, plain language, each row a one-click deep link:
- "3 quotations were accepted but never invoiced — invoice them" (conversion gap)
- "2 invoices are overdue more than 30 days — chase the client" (aging)
- "1 invoice has no purchase order — attach it or mark PO waived"
- "5 draft invoices were created from accepted quotes — review and send"
- "Bank statement not reconciled this month — upload it"
Each item shows why it matters in one sentence ("Money you have earned but not asked for yet") and the amount at stake.

**b. Business-cycle map** — a compact horizontal flow (Client → Quotation → Accepted → PO → Invoice → Paid) with live counts and money at each stage, clickable. A newcomer sees the whole company in one line and where things are stuck.

**c. Plain-language layer everywhere**
- A glossary tooltip on jargon terms (PO, AR, VAT/TVA, PVR, aging, reconciliation, receivable) — one shared `Explain` component so labels stay short.
- Empty states become instructions: instead of "No invoices", "No invoices yet. Invoices are how you ask a client to pay. Start from an accepted quotation." with the action button.
- Status chips get a hover explanation of what the state means and who acts next ("Draft — not sent yet, you must send it").

**d. Next-step hint on every document detail panel** — one sentence at the top of the quotation/invoice/PO panel telling the user the single next action, derived from status ("Waiting on the client's answer — follow up", "Accepted: create the invoice", "Overdue 12 days: send reminder"), with the button next to it.

**e. First-run tour + role-aware home** — a short dismissible 5-step tour, and for sales users a home panel limited to their quotations/clients/projects so they see only what they can act on.

## 2. Audit trail for automated acceptance

Today accepting a quote logs a `created` entry on the PO and invoice only. Extend it so the acceptance itself is a traceable event:
- On the **quotation**: an `accepted` audit entry naming who accepted it and exactly which documents were spawned (numbers, ids, amounts, payment terms used, whether an existing PO was reused).
- On the **PO** and **invoice**: keep the creation entry, and add the source quote id/number plus actor in `details` so the timeline can render a link back.
- **Undo**: when the user hits Undo in the 10s window, write a compensating `acceptance_undone` entry on all three documents (never delete history) recording what was removed and by whom.
- **Redo**: if the acceptance is redone through global undo/redo, write `acceptance_redone` with the re-created ids.
- Every entry is attributed to the signed-in user and stamped, and surfaces in the existing document activity timeline and board history panel with readable summaries.

## 3. Notifications on automated acceptance

When acceptance creates documents, fan out one grouped in-app notification (email if the recipient enabled it):
- **Recipients**: the quotation's assignees (up to 3), the quotation creator, the linked app user of the client's owning team member, and company admins/finance who watch `quote_accepted` — deduplicated so nobody gets it twice.
- **Content**: "Q-2026-014 accepted — PO PO-2026-009 and invoice INV-2026-031 created as drafts", with client name and payable total.
- **Smart links**: shortcut actions in the notification to open the quotation, the PO, or the invoice directly (deep links to the detail panel, same pattern as existing notification hrefs).
- Undo within the window marks the notification as retracted and appends a follow-up line, so the inbox never claims documents exist that were rolled back.
- Respects existing quiet hours, digest, and per-event preferences; a new dedicated event key keeps it separately toggleable from plain accept/reject.

## Technical notes

- Extend `ActivityAction` in `src/lib/document-activity.ts` with `accepted`, `acceptance_undone`, `acceptance_redone`; no schema change needed (`document_activity.details` is jsonb and the table is append-only).
- Move the audit + notify calls into `createFromAcceptedQuote` / the undo path in `src/lib/quote-accept.ts` and `src/components/accept-quote-dialog.tsx` so any caller gets them.
- Add a `quote_auto_documents` key to `src/lib/notification-events.ts` and route delivery through the existing `notify()` → `pushNotification` server fan-out (recipient resolution stays server-side in `notifications.server.ts`).
- New UI: `src/components/next-actions-panel.tsx` (task list), `src/components/business-cycle-bar.tsx`, `src/components/explain.tsx` (glossary tooltip), plus a `src/lib/next-actions.ts` that derives the task list from existing helpers (`conversion-gap`, `aging`, `invoice-money`, `sop-summary`) — pure functions, unit-testable.
- No database migration required.

## Suggested order

1. Audit trail (small, self-contained).
2. Acceptance notifications with smart links.
3. Next-actions panel + business-cycle bar.
4. Plain-language layer: glossary, empty states, status explanations, per-document next step.
5. First-run tour.
