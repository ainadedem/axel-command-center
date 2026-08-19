# Invoices show no client or project

## What I confirmed

The invoices page renders Client and Project exactly like quotations (same columns, same lookup, same detail panel). The columns are blank because the data is missing in the database:

- Invoices: 58 total, only 7 have a client and 6 have a project.
- Quotations: 24 total, 19 have a client and 16 have a project.
- All 51 client-less invoices were blanked in the same write (14 Aug, 20:35) and none of them carry a quotation or purchase-order link, so there is no direct link to rebuild from.

The write path that caused this is already guarded (client/project keys are now omitted rather than nulled), so the loss is historical, not ongoing.

## Recovery signal found

The Logia general-ledger seed (sales journal) contains one entry per invoice number, and each entry's 411000 receivable line is labelled with the customer name — e.g. `FAC-LOG/01-26/003 -> AIRTEL MADAGASCAR`. 47 of the 51 blank invoices have such an entry.

## Plan

1. **Rebuild client links from the ledger.** Match each blank invoice by company + invoice number to its sales-journal entry, take the 411000 line label, and match it to an existing client of the same company (case- and accent-insensitive, trimmed). Only write when the match is unambiguous; never overwrite an invoice that already has a client.
2. **Derive projects where safe.** For each recovered invoice, if the client has exactly one project in that company, link it. Ambiguous or project-less clients are left empty rather than guessed.
3. **Report the leftovers.** Produce the short list of invoices that could not be matched (no ledger entry, unknown customer name, or several candidate clients) so they can be fixed in one pass with the existing bulk "Edit client / project" action on the invoices page.
4. **Verify.** Re-count client/project coverage after the fix and open the invoices page to confirm the Client and Project columns and the detail panel now read like quotations.

## Technical notes

- Recovery is a one-off SQL migration: a temporary mapping table of `(number, customer_label)` built from `src/lib/logia-grand-livre-seed.json` entries in journal `VTE`, joined to `public.invoices` on `company_id + number`, then to `public.clients` on normalised name within the same company.
- Project inference uses `public.projects.client_id` with a `count(*) = 1` guard.
- No schema change, no UI change, no change to numbering, amounts or status.
