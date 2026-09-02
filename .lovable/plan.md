# Weekly payment approval run (Thursday)

A single place where every outgoing payment is requested, reviewed by Finance, and released by you — normally on Thursday, with exceptions allowed only when a written justification is given.

## The process

```text
Requester            Finance review            Final approval        Release
(PM / Finance)  ->   (checks amount,     ->    (you approve      ->  marked paid
 submits a           supplier, proof)          or reject)            in Expenses
 payment request)
```

Statuses a request moves through: Draft -> Submitted -> Finance reviewed -> Approved -> Paid, plus Rejected and Cancelled.

## The Thursday run

- Each week the app opens a payment run dated on the Thursday. Every request submitted before Wednesday 17:00 lands in that week's run.
- The run page shows the full batch: total per currency, per company, per supplier, and every line with its proof, project and account.
- You can approve the whole run in one click, or line by line. Rejecting asks for a reason.
- Requests submitted after the cut-off roll into next Thursday automatically.

## Exceptional (off-cycle) payments

- A requester can tick "Urgent — pay outside the Thursday run" and must type a justification; without it the request cannot be submitted off-cycle.
- Off-cycle lines are visually flagged, listed in their own section at the top of the approval queue, and their justification is stored in the audit trail.
- Reporting shows how many off-cycle payments were made each month, so the exception stays an exception.

## What can be requested

- Supplier bills and expenses (from the Expenses module — an existing unpaid expense can be pushed into a run in one click).
- Reimbursements and advances (staff medical, travel, cash advances).
- Any other outgoing money, entered as a free-form payment request with payee, account, amount, currency and proof.

Nothing gets marked as paid from the Expenses page anymore without going through an approved request — marking paid stays available to Finance/admins but records that it bypassed the run when no approval exists.

## Reminders and notifications

- Wednesday cut-off reminder to Finance and project managers: "Payment run closes today — X of your requests are still in draft."
- Thursday morning reminder to you: "N requests waiting, total amount per currency."
- Requesters are notified in-app the moment their request is finance-reviewed, approved, or rejected (with the reason).
- All three use the existing notification preferences, so each person can turn them off or route them to email.

## Where it lives

A new **Payment approvals** page under Axel Books → Treasury, using the same page layout as Projects (KPI strip, list, detail panel). The KPI strip shows: awaiting my approval, awaiting finance review, this week's run total, off-cycle this month, and rejected.

Visibility:
- Project managers see and create their own requests.
- Finance sees everything in their companies and performs the review step.
- You (super/group admin) see everything and hold the final approval.

## Technical notes

- Migration adds `public.payment_runs` (company_id, run_date, status open/locked/released, totals, released_by/at) and `public.payment_requests` (company_id, run_id, kind bill/reimbursement/advance/other, expense_id, supplier_id, payee, amount, currency, account_id, project_id, description, attachment_url, status, off_cycle boolean, off_cycle_reason, requested_by, reviewed_by/at, approved_by/at, rejected_reason) plus `payment_request_events` for the audit trail. Each table gets GRANTs to `authenticated`/`service_role`, RLS enabled, and company-scoped policies mirroring `expenses`: requesters read/write their own, finance/manager/company_admin read+review inside their companies, group/super admin approve.
- Approval transitions run through a security-definer function so a requester can never approve their own line and a role check is enforced server-side, not in the client.
- New `src/lib/payment-approvals.ts`: run resolution (which Thursday a request belongs to, cut-off math in UTC+3), status machine, and totals; reuses `toMGA` from `mock-data.ts` and the store semantics in `data-store.ts`.
- New `src/routes/_authenticated/payment-approvals.tsx` built on `projects-style-page-shell.tsx` with `ListTable` + `MasterDetail`, and a "Request payment" action wired through `src/lib/create-action.ts`.
- Expenses page gains a "Request payment" row action that pre-fills a request from the expense; approving a request writes back to the expense (`paid`, `status`) through the existing store.
- Two new notification event keys (`payment_request_decision`, `payment_run_reminder`) added to `src/lib/notification-events.ts`, dispatched from the approval transitions and from a new public hook route `src/routes/api/public/hooks/payment-run-reminders.ts` scheduled by pg_cron twice a week (Wednesday cut-off, Thursday morning) — a weekly cadence, no polling loop.
- Every transition writes to `src/lib/document-activity.ts` with `docType: "payment_request"` so the existing audit panel renders it.
- Module registration in `src/lib/modules.ts` under Books → Treasury, gated by `use-effective-role.ts` (hidden from sales-only users).
