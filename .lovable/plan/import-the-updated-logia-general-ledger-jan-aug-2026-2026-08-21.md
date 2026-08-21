# Import the updated Logia general ledger (Jan–Aug 2026)

Your file is the same Logia ledger as the one already in the app, but restated and extended. Compared with what is loaded today:

| Month | In app | In your file | Change |
|---|---|---|---|
| January | 588 lines | 586 lines | corrected (−915,000 Ar debit) |
| February–April | identical | identical | no change |
| May | 445 lines | 449 lines | corrected (+6,000,000 Ar) |
| June | 546 lines | 567 lines | corrected (−11,766,595 Ar) |
| July | — | 592 lines | new |
| August | — | 165 lines | new |

Total: 1,340 accounting pieces / 3,606 ledger lines across six journals (Banque, Caisse, Factures fournisseurs, Factures clients, Opérations diverses, Report à nouveau).

## Scope

Logia Madagascar only. Nothing belonging to Winford Next or Axiom Unlimited is read, rewritten or deleted at any point of the import; every write is filtered on Logia's company id.

## What will happen

**1. The ledger becomes the shared source of truth**
Today the Logia ledger only exists inside the app bundle, so it is re-created locally in each browser. It moves to the backend: imported once, stored centrally, and read by everyone on any device. The Grand Livre, Journal, Balance, Bilan and Compte de résultat pages then all read Jan–August 2026.

**2. Full replace, restatements included**
Logia's ledger is replaced by exactly what your file contains, so the January, May and June corrections are applied and July/August are added. Other companies (Winford, Axiom) are untouched.

**3. Derived records rebuilt, manual work preserved**
Clients, suppliers, bank/cash accounts, sales invoices, supplier expenses and bank/cash transactions are recomputed from the new ledger. Anything you entered by hand is kept and re-applied on top:
- client and supplier enrichment (contacts, address, NIF/STAT/RCS, bank details, categories, avatars),
- invoice fields the ledger does not know about (subject, tax rate/amount, discounts, PO link and PO waiver, deal link, signer/stamp settings, handover proof, activity trail),
- quotations, purchase orders, PVR records, opportunities, projects, budgets, payroll, reconciliations — none of these are regenerated.

Matching is by ledger identity (piece number for entries, account + name for third parties), so an invoice that already exists is updated rather than duplicated.

**4. Balances and reports refreshed**
BNI and Caisse balances, the receivable/payable ageing, pipeline roll-ups and dashboard KPIs all follow the new figures automatically once the data lands.

**5. Import report**
After the run you get a summary: entries added / updated / removed, invoices and expenses touched, new clients and suppliers created, plus any ledger line that could not be matched to a third party so you can review it.

## Technical notes

- New tables: `public.journal_entries` (company_id, journal, piece, date, description, source) and `public.journal_lines` (entry_id, account, label, debit, credit, tiers), with GRANTs to `authenticated`/`service_role` and RLS mirroring the existing company-access policies used by `transactions`. Indexes on `(company_id, date)` and `(company_id, piece)`.
- Parsing: French number format (`1 234,56`), `d/m/yyyy` dates, journal names mapped to the existing codes (AN, BNQ, CSS, ACH, VTE, OD) exactly as the current seed does, so `src/lib/pcg.ts` logic is unchanged.
- Load: rows are inserted through the data tools in batches, keyed on `(company_id, piece, date)`; Logia entries not present in the file are removed.
- Derivation reuses the existing `seedLogiaDerivedData` mapping rules, but rewritten as a merge: upsert by stable id (`cli_log_*`, `sup_log_*`, `inv_log_*`, `txn_log_*`) with a whitelist of ledger-owned fields (dates, amounts, currency, account, third party) — every other column on an existing row is left as-is.
- `src/lib/pcg.ts` switches from importing `logia-grand-livre-seed.json` to loading `journal_entries` from the backend, with the JSON kept only as an offline fallback; `src/lib/db-sync.ts` gains the mappers for the two new tables.
- The Grand Livre page's "re-seed" action becomes a "Re-import from backend" refresh, and gains the import report dialog.
- Verification after load: total debit = total credit per journal and per month, and month totals matched against the source file before the old rows are dropped.
