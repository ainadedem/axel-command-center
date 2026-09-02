# Payment approvals: cash impact, CEO tasks, and email alerts

Four connected pieces so approved payments show up in the money view, you get one place to act, and nothing sits unnoticed.

## 1. Approved payments flow into Cash flow

Today the Cash flow page only tracks money coming in (invoices, collections, outstanding balance). Approved outgoing payments are invisible there.

Changes:
- When a request is marked **Paid**, it writes the money movement: the linked expense is settled (paid amount + status) and a bank transaction is recorded on the chosen account, dated the run day.
- Cash flow gains an outgoing side: "Approved to pay" (committed but not yet released) and "Paid out" per month, next to invoiced/collected.
- A **Net cash** figure per month = collected − paid out, plus a running remaining balance.
- Approving alone does not move cash; it shows as committed. Marking paid moves it. This keeps the bank reconciliation honest.

## 2. Walk a real Thursday run end to end

Using the live app (not mock data):
1. Create a real expense on a company you can access.
2. Raise a payment request from that expense.
3. Finance review → final approval → mark paid.
4. Confirm at each step: it appears under the right Thursday run, the status and "who has the ball" text change, the KPI cards move, and once paid the Cash flow page shows the outflow and updated balance.

Anything that breaks along the way gets fixed in the same pass, and the test records are removed afterwards.

## 3. CEO task list page

A new **My tasks** page (Project-page layout) that answers "what needs me today":
- **Payment approvals waiting on me** — grouped by run day, with amount, payee, and off-cycle flag first.
- **Other decisions** — quotes about to expire, invoices overdue, quotes accepted but not yet invoiced, projects stuck on a stage. These come from the existing next-actions engine.
- Each row shows its business context as clickable chips: project, client, quote number, invoice number, expense — so one click gets you to the source document.
- Inline actions: approve, reject (with reason), or open.
- Counts of items waiting on you appear as a badge in the sidebar.

## 4. Email on every payment request

- When a request is submitted, Finance (finance/admin roles on that company) and the final approver receive an email: amount and currency, payee, project, linked quote/invoice if any, why it is needed, run day, and a direct link.
- A decision email goes back to the requester when reviewed, approved, rejected (with the reason), or paid.
- Wednesday cut-off reminder to anyone with drafts; Thursday morning summary of the run to you.
- These respect the existing notification preferences (quiet hours, digest) and appear in the in-app inbox too.

Note: email delivery needs a Resend API key stored in the backend. Until it is set, everything still arrives in the in-app notification centre and nothing is lost — I'll ask for the key when I reach that step.

## Technical notes

- `src/lib/cash-flow.ts`: add outgoing rows derived from `payment_requests` (status `approved` = committed, `paid` = released) plus their expense/transaction links; extend `cashFlowByMonth`/`cashFlowTotals` with `paidOutMGA`, `committedMGA`, `netMGA`. Cash flow page gains an outflow section and net column.
- Marking paid: extend `decidePaymentRequest`'s client wrapper to settle the linked expense and insert a `transactions` row (negative/outgoing) on the request's account, guarded so it runs once.
- New route `src/routes/_authenticated/my-tasks.tsx` on `ProjectsStylePageShell`, combining `usePaymentRequests` with `src/lib/next-actions.ts`; smart links via existing `doc-number-link` / `doc-link-chips` helpers. Registered in `src/lib/modules.ts`.
- Emails reuse `fanOut` in `src/lib/notifications.server.ts` with the new `payment_request_decision` and `payment_run_reminder` event kinds; recipients resolved from `user_company_access` roles. Reminders run from a scheduled hook alongside the existing `notification-digest` route (twice weekly: Wednesday cut-off, Thursday morning).
