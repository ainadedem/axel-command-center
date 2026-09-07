# Signer list is missing you (and other org-wide admins)

The signer dropdown lists people from the per-company access table. Your account is an
org-wide administrator: it has full access to every company without a per-company access
row, so the list has no entry for you — confirmed by checking the accounts, where your
profile shows the super-admin role and zero company rows. The same gap affects any other
org-wide admin.

## Fix

Update the colleague lookup so a company's people list is the union of:

- everyone with an access row for that company (as today), and
- everyone holding an org-wide administrator role (super admin, group admin), shown with
  that role as their label.

Duplicates are collapsed, so someone who is both keeps a single entry. The caller is
always included when they can see the company, so you can pick yourself as signer.
Names still fall back to a tidied-up email when no display name is set, and the list stays
alphabetical.

Access rules do not change: the lookup still returns nothing unless you have access to the
company, and it still exposes only name, email, photo and role.

## Technical notes

- Replace `public.company_directory(uuid)` with a version whose body is
  `user_company_access` for the company `UNION` profiles of users in `user_roles` with
  role in (`super_admin`, `group_admin`), deduplicated on `user_id` (prefer the
  company-specific role label, else the global role). Same `security definer`, `stable`,
  `search_path = public`, same caller guard, execute granted to `authenticated` only.
- No client changes needed: `useCompanyUsers` / `useCompanySalesUsers` in
  `src/hooks/use-company-users.ts` already read the RPC. `SALES_CAPABLE_ROLES` gains
  `super_admin` and `group_admin` so admins can also be quotation assignees.
- Verify signed in: open an invoice preview and confirm your own name appears and can be
  selected, then reopen the invoice to confirm it stuck.
