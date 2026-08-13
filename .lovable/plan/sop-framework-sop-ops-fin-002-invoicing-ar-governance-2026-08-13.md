# SOP Framework + SOP-OPS-FIN-002 (Invoicing & AR Governance)

Build a reusable SOP hub in Axel, then wire the first SOP's controls into invoices, purchase orders, and payables. All rules are advisory: nothing is ever blocked from saving — non-compliance shows as visible warnings, badges, and dashboard counts.

## 1. SOP hub

New page **Operations > SOPs**:
- List of SOPs with code, title, version, effective date, owner, status.
- Detail view rendering the full SOP text (sections, rules, escalation ladder).
- Each SOP can declare *compliance checks*; SOP-OPS-FIN-002 ships with live checks that read real data and show pass/warn counts.
- Seeded with SOP-OPS-FIN-002 v1.0 exactly as written.

## 2. PO gating + PVR tracking ("No PO, No Work")

- Purchase orders gain **client PO code** (already has client reference — surfaced as the enforced field) and **buying legal entity** so Airtel Madagascar S.A. and Airtel Mobile Commerce Madagascar S.A. stay decoupled. Warning when an invoice's client entity does not match its PO entity.
- New **PVR / Job Completion** record attached to a project or invoice: signed date, completion percentage (must declare 100%), matching quote/invoice identifier, client sign-off names, uploaded scan.
- Invoice dialog shows a **Compliance** strip: PO linked / PO waived (reason) / PO missing, PVR present or missing, entity mismatch. Saving is never blocked.
- Projects list gains an "unbacked production" warning when work exists with no PO logged.

## 3. Invoice dating & handover archive

- **Ingestion date** field: the business day the invoice entered the client's system, separate from issue date.
- Warning when issue date is a floating/future date or differs from ingestion date without a note.
- **Handover proof**: upload the stamped receiving-desk scan against the invoice, with who delivered and when; missing proof after ingestion raises a warning.

## 4. AR aging & escalation matrix

- Aging computed from ingestion date (falling back to issue date): Day 15 / 30 / 45 / 60 stages.
- Each open invoice shows its current stage and the required action (receipt validation check, SCM phone sweep, formal dunning notice, service suspension).
- Escalation log per invoice: record an action taken, by whom, when — the stage clears once logged and advances on schedule.
- Invoices page gains an "Escalation" filter/column; overdue rows highlight the pending stage.

## 5. Payables controls

- Expenses/supplier payouts gain **payment cycle** flags:
  - Thursday labor cycle — warn when a consultant/talent payout is scheduled off-Thursday.
  - Back-to-back — link a payout to the client invoice that funds it; warn if the payout is scheduled before the client invoice is collected.
  - Medical overhead — 80% reimbursable tier, 30-day batch window with an age warning.
- Overhead mapping reminder: fixed monthly subscription lines flagged if unpaid after the 31st of the month.
- Banking routing: BNI 73832720001 vs BRED 05003026613 mapped to categories (telecom retainers / brand ambassador / TVS Funbike vs spot production / bank contracts); warn on routing mismatch.

## 6. Compliance dashboard + export

New **Compliance** dashboard (linked from the SOP hub):
- Tiles: unbacked projects, invoices missing PO, missing PVR, missing handover proof, invoices by escalation stage, payouts violating the Thursday/back-to-back rules.
- Drill-down tables from each tile.
- **CSV export** of the full PO / PVR / collection-milestone tracker, formatted for direct paste into Google Sheets.

## Technical notes

- Migration adds: `sops` and `sop_checks` metadata tables; `pvr_records`; `invoice_escalations`; new columns on `invoices` (`ingestion_date`, `handover_proof_url`, `handover_stamped_at`, `handover_by`), on `purchase_orders` (`buying_entity`), on `expenses` (`payment_cycle`, `funding_invoice_id`, `medical_claim`, `reimbursable_pct`). Every new table gets GRANTs plus company-scoped RLS matching existing tables.
- Uploads reuse the existing private `documents` bucket and `use-file-url` hook.
- Compliance rules live in one module (`src/lib/sop-compliance.ts`) returning typed findings, consumed by the invoice dialog strip, list badges, the dashboard, and the CSV export — one source of truth, no duplicated logic.
- Role scoping follows existing rules: sales users see no financial or AR content; company-scoped roles see only their companies.
