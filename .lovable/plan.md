# Finance dashboard, timeline calendar, project margins, faster journal entry

Four additions, each building on what already exists (weekly Thursday run, project stages, quote/invoice links, PCG journal).

## 1. Finance dashboard

New page **Finance** (sidebar, finance/admin roles only) centred on the approval cycle:

- Header: this week's Thursday run — run date, cut-off countdown (Wednesday 17:00, Antananarivo), status (open / released).
- KPI strip: awaiting review, awaiting your approval, approved this run, paid out this month, off-cycle share, average days from submission to payment.
- **Pending requests** list grouped by run date, with amount, payee, project/quote context chips and a one-click review/approve action reusing the existing approvals logic.
- **Approved by team** table: totals per team (requester's department from their team profile, falling back to "Unassigned"), showing request count, approved amount, paid amount and off-cycle count, with a bar chart of the last 6 months per team.
- All money in MGA, sales users have no access.

Assumption: "team" = the department on the requester's team-member profile. If you'd rather group by project owner or by company, say so and I'll switch it.

## 2. Calendar view

New page **Calendar** showing one month at a time (with a week toggle):

- Project stage markers: each stage's start date and due/end date, coloured by status (in progress, done, blocked, overdue), labelled `Project · Stage`.
- Thursday approval runs on every Thursday cell, with the batch total and request count.
- Payment request "needed by" dates and invoice due dates as secondary markers.
- Filters by company, project and marker type; clicking any marker opens the underlying project, run or invoice.

## 3. Project cost vs quote/invoice, with margin

On the project detail panel, a **Profitability** block:

- Quoted (accepted quotes on the project), Invoiced, Collected, Actual cost, Margin amount and Margin %.
- Actual cost = project expenses + project-tagged bank transactions + released payment requests linked to the project, de-duplicated so a payment already booked as a transaction is not counted twice.
- Variance chips: invoiced vs quoted, cost vs quoted, with colour when margin drops below a set threshold.
- Same margin column available in the projects list and a portfolio margin KPI on the projects page header.

## 4. Type-to-find "compte" in the journal

Replace the long PCG dropdown in the journal entry dialog with a searchable combobox:

- Type digits (`706`) or words (`banque`, `client`) and matching accounts filter live, ranked with code-prefix matches first.
- Enter picks the top hit; the account name shows next to the code once selected.
- Same control used for both new and edited entries; free-typed codes that exist in the PCG are accepted directly.

## Technical notes

- New `src/lib/finance-dashboard.ts` (run + team rollups) and `src/lib/calendar-events.ts` (stage/run/invoice event model); both pure, no store writes.
- Extend `src/lib/project-kpis.ts` with `projectProfitability()` reusing `invoicePayable` and `quotePayable`; no schema change needed.
- New routes `src/routes/_authenticated/finance.tsx` and `.../calendar.tsx` using `ProjectsStylePageShell`; registered in `src/lib/modules.ts` with role gating via `use-effective-role`.
- Journal combobox built from the existing `pcgAccounts` list with shadcn `Command` inside a popover — no data-layer change.
