# SOP compliance: demo mode, weekly summary, alerts, follow-up drafts, walkthrough

Five additions on top of the existing SOPs & Compliance page.

## 1. Demo mode (sandbox company)

A "Load demo data" button on the SOPs page creates a clearly labelled demo company (**DEMO — Sample Co**, violet "DEMO" badge in the company switcher) containing:

- One sample client with full billing details.
- Five invoices engineered so every rule fires at least once:
  - clean, fully compliant invoice (no flags)
  - invoice with no purchase order (critical red flag)
  - invoice with a PVR at 60% and no handover proof (critical + warning)
  - invoice ingested 38 days ago with only the Day 15 step logged (Day 30 overdue)
  - invoice ingested 72 days ago with nothing logged (all four ladder steps red)
- Matching purchase orders, PVR records, one escalation log entry, and two payables (one back-to-back without a funding invoice, one medical claim at 60%).

A "Remove demo data" button deletes the demo company and everything under it in one click. Real company data is never touched, and demo records are excluded from any real-company totals because they live in their own company.

## 2. Weekly compliance summary card

A card at the top of the Compliance tab covering the last 7 days:

- Red flags (critical) and yellow flags (warnings), with the change vs. the previous week.
- Overdue invoices by bucket (15–29d, 30–44d, 45–59d, 60d+) and total money at risk.
- Escalation steps due this week and how many were logged.
- **Who needs to act** — the list is grouped by owner: the person who created the invoice, falling back to the company's finance admins when no creator is recorded. Each row shows the person, how many items are theirs, and the exposure attached to them.
- Export the whole summary to CSV.

## 3. Email alerts at Day 15 / 30 / 45 / 60

Recipients: **finance and company admins of the company that owns the invoice** (per your answer).

- A nightly job scans open invoices, works out which ladder stage each one has just crossed, and sends one email per invoice-stage — never a duplicate for the same invoice and stage.
- The email states the invoice number, client, balance, days outstanding, the SOP action required at that stage, and any missing documentation, with a direct link to the invoice.
- A per-user toggle in Settings ("Email me AR escalation alerts") and a per-stage on/off list so you can, for example, only get Day 45 and Day 60.

**Prerequisite:** sending email requires a verified sender domain on a domain you own. None is configured yet, so this part needs a one-time domain setup before alerts can go out. Everything else in this plan works without it, and the alert screen will show a clear "email not configured yet" state until then.

## 4. Copy-paste follow-up messages (Day 30 and Day 45)

On each row of the AR escalations tab, a "Draft follow-up" action opens a dialog with a ready message composed from the invoice's actual state:

- Day 30 — polite written follow-up to the client finance contact: invoice number, amount, ingestion date, days outstanding, and a request for a payment date.
- Day 45 — formal reminder: the same facts plus an explicit list of the documents attached or still missing (PO reference, signed PVR, stamped handover proof), and a settlement deadline.
- If documentation is missing on our side, the draft says so plainly so you fix it before sending.
- Available in English and French (following the document language on the invoice), with a Copy button and a "Copy and log this step" button that also records the ladder action.

## 5. Sixty-second onboarding walkthrough

A guided tour that starts automatically on first visit to the SOPs page (and re-runnable from a "Take the tour" link):

- Six short steps highlighting the KPI row, the weekly summary, the violations table, the escalation ladder buttons, the follow-up draft action, and the SOP library.
- Next / Back / Skip, keyboard and screen-reader accessible, respects reduced-motion.
- Completion is remembered per user so it never nags.

## Technical notes

- **Demo data:** a `is_demo boolean` flag on `companies` plus a client-side seeder in `src/lib/sop-demo.ts` writing through the existing stores and `db-sync`, so demo rows go through the same RLS path as real data. Removal cascades on the company row.
- **Summary:** pure derivation in `src/lib/sop.ts` (`weeklySummary(violations, invoices, escalations)`), rendered by a new `WeeklySummaryCard` component — no new tables.
- **Alerts:** new `ar_alert_log` table (invoice_id, stage, sent_at, recipients) for idempotency, and `notification_prefs` (user_id, channel, stages). A `pg_cron` job hits a TanStack server route at `src/routes/api/public/hooks/ar-escalation-alerts.ts` authenticated with the anon key; that route recomputes stages server-side, resolves recipients from `user_company_access` (finance/company_admin/super_admin), and sends via the platform app-email queue. Requires `setup_email_infra` + `scaffold_transactional_email` after the sender domain is verified.
- **Drafts:** `src/lib/ar-followup.ts` builds templates from `Invoice`, linked `PvrRecord`, `PurchaseOrder`, and the existing i18n helper in `doc-i18n.ts`.
- **Tour:** lightweight self-contained overlay component (`src/components/guided-tour.tsx`) driven by element refs; completion stored on the user profile.
