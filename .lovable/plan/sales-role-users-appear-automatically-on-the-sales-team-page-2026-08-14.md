# Sales-role users appear automatically on the Sales team page

Today the Sales team page is a manual list: an admin has to pick someone from the Team database and give them a sales role. App users granted the "sales" company role in Users & Access never show up there, and team profiles have no link back to the app user account.

## What changes

1. **Sales role grant = sales team membership**
   - When a user holds the `sales` role for a company (granted at user creation or later in Users & Access), they are added to the Sales team page automatically with the **Acquisition** role by default. Admins can change it to Closer or Acq + Closer afterwards.
   - When the `sales` role is removed from a user, they are removed from the Sales team list automatically (their Team profile stays).

2. **Linked to a Team profile**
   - Matching is by email: if a team member with the same email already exists, the user account is linked to that existing profile.
   - If no match exists, a Team profile is created from the account (display name, email, avatar, the company the role was granted for).

3. **Visible link in both pages**
   - Team page: a row shows an "App user" indicator with the account email and its sales role; admins can open the linked user from there.
   - Sales team page: each card shows whether the person is a linked app user or a manually added person, plus a link to their Team profile.
   - Auto-synced sales entries cannot be deleted by hand from the Sales page — the page explains the role must be removed in Users & Access.

## Technical notes

- Migration: add `user_id uuid` (nullable, unique) to `public.team_members` so a team profile can point at an auth account, plus `source text` on `public.sales_members` (`manual` | `role_sync`) to mark auto-created rows. GRANTs/RLS stay as they are; policies extended so a user's own linked row remains readable.
- New server function module `src/lib/sales-sync.functions.ts` (admin-verified, service-role loaded inside the handler):
  - `syncSalesTeamFromRoles()` — reads `user_company_access` rows with `role = 'sales'` plus `profiles`, links/creates `team_members` by lowercase email, inserts missing `sales_members` (`role = 'acquisition'`, `source = 'role_sync'`), and deletes `role_sync` rows whose user no longer has the sales role anywhere.
  - Called after any role change in `users-access.tsx` (create user, role select change) and once when the Sales team and Team pages load.
- `src/lib/mock-data.ts`: extend `TeamMember` with `userId?: string` and `SalesMember` with `source?: "manual" | "role_sync"`; map the new columns in `src/lib/db-sync.ts` (`tmToDb`/`tmFromDb`, `smToDb`/`smFromDb`).
- `src/routes/_authenticated/sales-team.tsx`: show linked-account badge, link to `/team`, disable delete for `role_sync` entries, keep the manual add flow.
- `src/routes/_authenticated/team.tsx`: show linked app-user badge/email next to the sales-role chip.
