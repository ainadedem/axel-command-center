# Fix: can't pick a signer on invoices

## What's wrong

The signer list on an invoice is built from the list of people who have access to that invoice's company. The database currently only lets you see *your own* access row — nobody else's — unless you are a group administrator. Two consequences, both confirmed:

- The list comes back empty (or with only yourself), so the "Signer" dropdown in the invoice preview shows almost nobody, and disappears entirely when the list is empty.
- The list is also limited to sales-type roles, so finance people are never offered as signers even when visible.

On top of that, the New/Edit invoice form has no signer field at all — the only place to set it is the preview toolbar.

## What will change

1. **Everyone in the company shows up.** A secure database function returns the colleagues of a company (name, email, photo, role) to anyone who has access to that company. It only ever returns people of companies you can already see, and only their name, email, photo and role.
2. **Signer list is no longer sales-only.** Any person with access to the invoice's company — including finance and admins — can be chosen as signer. Names use the same full-name resolution as the printed document (never a raw email).
3. **A "Signer" field in the New/Edit invoice form**, next to the existing document fields, so it can be set while creating or editing, not only from the preview. It defaults to the person creating or last editing the invoice, matching today's behaviour.
4. **The dropdown always appears** on invoices, with a clear "No signature" option and a short hint when nobody is available yet, instead of silently vanishing.
5. Quotations and purchase orders inherit the same corrected people list, since they share the hook.

Signature images themselves are unchanged: a person's signature only prints if they uploaded one in their own settings.

## Technical notes

- Migration: `public.company_directory(_company_id uuid)` — `security definer`, `stable`, `set search_path = public`, returns `user_id, display_name, email, avatar_url, role`. Body checks `app_private.has_company_access(auth.uid(), _company_id)` (or super/group admin) and returns nothing otherwise; joins `user_company_access` with `profiles`. `grant execute ... to authenticated`. No table policy is loosened and no new table is created.
- `src/hooks/use-company-users.ts`: replace the direct `user_company_access` + `profiles` queries with an `rpc("company_directory", ...)` call. Keep `useCompanySalesUsers` (sales-capable filter, used by assignee pickers) and add `useCompanyUsers` returning everyone, used for signer pickers.
- `src/components/invoice-preview.tsx` (and the quotation/PO preview call sites) switch to `useCompanyUsers`.
- `src/components/document-preview.tsx`: render the Signer block whenever a document is open — when `signers` is empty, show the disabled select with the "No signature" option and a one-line hint.
- Invoice dialog in `src/routes/_authenticated/invoices.tsx`: add a signer `Select` bound to `signerId` in the Document section; submit writes `signer_id` through the existing `invoicesStore` path (already mapped in `db-sync.ts`).
- Verify with a signed-in Playwright pass: open an invoice preview, confirm the dropdown lists company colleagues, pick one, reopen and confirm it stuck.

## Out of scope

No change to stamp placement, signature upload, PDF layout, or numbering.
