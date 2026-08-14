# Fix: editing a quote or invoice loses client, project and company

## What I confirmed

Two separate problems, one of which has already destroyed data.

**1. Client and project links were wiped in the database (confirmed).**
56 of 58 invoices currently have no client and no project, and all of them were
overwritten at the same moment (14 Aug, 10:15). 5 Axiom quotations are in the same state.
The invoice list shows "—" in the Client and Project columns for those rows, so the
editor has nothing to restore when you reopen them.

The write path explains it: when an invoice or quote is pushed to the backend, the
client and project are only kept if the stored id is a real database id. Any row whose
client/project id is a legacy local id is written as *empty* instead of being skipped —
so a background sync of local seed rows silently blanked the real links on rows matched
by company + document number.

**2. The editor shows the wrong company (reproduced).**
Opening the pencil/edit on a Logia document sometimes shows **Winford Next** in the
Company field while the number and status still belong to the original document, and the
client list then shows "Create client first". The document number is unchanged, so this
is not the "new document" path — the company selector is being re-pointed at the first
company in the list. The exact trigger (which of the selection effects fires with an
empty value) is not yet pinned down; step 2 below verifies it before changing behaviour.

## Plan

**Step 1 — stop the data loss (highest priority)**
- In the backend mapping, never send an empty client/project/PO/quote link when the
  document actually has one. If the id cannot be resolved to a real backend id, leave the
  existing stored value untouched instead of clearing it.
- Apply the same rule to quotes, invoices and purchase orders.
- Add the same protection to the local-seed replay so demo/local rows can never overwrite
  a real document that already exists in the backend (match on company + number).

**Step 2 — pin down and fix the company reset**
- Instrument the invoice and quote editors to log the company value at open, right after
  initialisation and after each reconcile pass, then reproduce by opening the same
  document twice in a row.
- Fix whatever that shows. The most likely correction: treat "editing an existing
  document" as a hard lock — the company, client and project selects keep the value stored
  on the document and are never auto-switched, even when the value is momentarily missing
  from the option lists (currently the guard is skipped when the value is empty, which lets
  the fallback-to-first-company path run).
- Show the document's own company/client/project in the select even when it is not in the
  loaded list, so the field reads correctly instead of falling back.

**Step 3 — recover what was wiped**
- Rebuild client and project links from the strongest available signals: the linked
  quotation or purchase order on the invoice, the project's own client, and matching
  document activity history.
- Report anything that cannot be resolved automatically as a short list you can reassign
  in one pass with the existing bulk "Edit client / project" tool.

## Technical notes

- `src/lib/db-sync.ts`: `invoiceToDb`, `quoteToDb`, `poToDb` currently do
  `x && isUuid(x) ? x : null`. Change to omit the key when unresolved, so an upsert never
  nulls an existing column. Also guard the seed-replay path used at hydration.
- `src/hooks/use-reconciled-selection.ts`: the `preserve` guard returns early only when
  `currentValue` is truthy; in edit mode it must also skip the fallback when the value is
  empty. Add a `lock` mode used by all three document editors when `editing` is set.
- `src/routes/_authenticated/invoices.tsx`, `quotations.tsx`, `purchase-orders.tsx`: use
  the locked mode and include the saved record in the select options (`withSelected`) for
  the company field too, not just client/project.
- Recovery runs as a one-off SQL migration using `invoices.quote_id` / `po_id`, and
  `projects.client_id`; no schema change.
