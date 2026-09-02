# Real stage timelines, cash flow page, and quote expiry

## 1. Project stages with real dates and a "move forward" button

Each workflow step gains a real **started on** and **finished on** date, shown inline next to the step name.

- When a step becomes In progress, its start date is stamped automatically; when it is marked Done, its end date is stamped.
- Both dates stay editable, so a step completed last week can be dated correctly.
- Each step row gets a primary **Advance** button: it completes the current step, stamps its end date, and starts the next one (stamping its start date) in a single click. The status dropdown stays for exceptions (Blocked / Skipped).
- Steps that complete themselves from documents (Quote, PO, PVR, Invoice, Paid) take their end date from the underlying document's date (quote acceptance, PO issue date, PVR signature date, invoice issue date, payment date) instead of "now".
- The detail panel shows a duration per step (days) and a total elapsed time, so the progress bar reflects real timelines rather than click order.

## 2. End-to-end verification

After the build, run a scripted browser pass against the live app: create a project, walk it through Quote → PO → Kickoff → Delivery → Invoice, and confirm the progress bar percentage, the stage dates, and the Projects KPI strip all update. Findings are reported back with screenshots.

## 3. Cash flow page

A new **Cash flow** page under Finance listing every invoice with:

- client, invoice number, issue date, due date
- invoiced amount, amount paid, payment date(s), remaining balance
- status chip (paid / partly paid / overdue / open)

Above the list: monthly totals (invoiced, collected, outstanding) as a table plus a bar chart, with a period picker and company scope matching the rest of the app. Rows expand to show the linked bank transactions already captured by the payment-matching chain. Sales users see no money figures, consistent with existing role rules.

## 4. Quotation expiry and reminders

- Quotations already carry a "valid until" date; it becomes required and defaults to issue date + 30 days (editable per quotation).
- Any quotation still in Draft or Sent past its valid-until date is automatically closed as **Expired** — evaluated on load and by the existing scheduled job, with an audit-trail entry and an in-app notification to the assignees and creator.
- A dashboard reminder card lists quotations expiring in the next 7 days and those that just expired, each with one-click actions: extend validity, mark accepted, or close.

## Technical notes

- Migration on `public.project_stages`: add `started_at timestamptz`. `completed_at`, `planned_start`, `due_date` already exist. No other table changes.
- `src/lib/project-stages.ts`: `setStageStatus` stamps `startedAt`/`completedAt`; new `advanceStage()` helper does complete-current + start-next atomically; `resolveStages` derives auto-step end dates from the evidence documents.
- `src/components/project-workflow.tsx`: date chips, editable dates, duration display, Advance button.
- `src/lib/db-sync.ts`: map `started_at`.
- New `src/lib/cash-flow.ts` (per-invoice rows + monthly rollups, reusing `invoice-money.ts` and `aging.ts`) and new route `src/routes/_authenticated/cash-flow.tsx` built on `ProjectsStylePageShell`, added to the sidebar Finance group.
- New `src/lib/quote-expiry.ts`: expiry evaluation, auto-close through `applyQuoteStatus` (so guards, audit and notifications run), and a `useExpiringQuotes` hook; dashboard card in `src/components/` wired into `dashboard.tsx`.
