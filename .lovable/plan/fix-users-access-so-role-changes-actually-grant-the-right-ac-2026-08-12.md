# Fix Users & Access so role changes actually grant the right access

## What's broken today (verified)

1. **Roles are applied globally, not per company.** The app merges every role a user holds — global roles plus every per-company role — into one flat list. So a user who is `sales` in one company and `finance` in another sees finance screens everywhere, and someone who is company admin of a single company gets admin UI in all companies. Switching the company selector changes the data, not the permissions.
2. **Group admins can't change platform roles, but the page lets them try.** The database only allows super admins to write platform roles, so a group admin's change fails with an error toast and nothing is saved.
3. **Changing a platform role is destructive.** The page deletes all of a user's platform roles first and then inserts the new one; if the insert is refused, the user is left with no role at all.
4. **Two roles in the picker aren't understood by the database rules.** "Manager" and "Project manager" can be saved on a company, but the security rules only recognise company admin / group admin / super admin, so a manager gets less access than the page implies.
5. **No refresh after a change.** Changing your own role updates the table on screen but not the live session, so the menus and permissions stay as they were until a full reload.

## The fix

### Permissions become company-scoped
- Resolve the effective role from the currently selected company (platform roles still win everywhere), instead of flattening all roles into one list.
- `canSeeFinance`, `isSalesOnly`, `isAdmin` and `roleFor` all derive from that single effective role.
- Group scope ("All companies") keeps the strongest role the user holds, and is only selectable by group/super admins (already the case).
- A signed-in user with no role in the selected company gets no access to that company rather than a silent fallback.

### Users & Access page becomes honest and safe
- Platform-role picker is disabled with an explanatory tooltip unless the signed-in user is a super admin.
- Platform-role change becomes non-destructive: insert/upsert the new role first, then remove the old one; on failure nothing changes and the row reverts to its previous value.
- Company-role picker only offers roles the security rules actually enforce (Company admin, Finance, Sales, Viewer); Manager and Project manager are dropped from the picker. Existing rows carrying those values are shown as-is with a "legacy" marker so nothing silently changes meaning.
- After any successful change, reload from the database instead of patching local state, and refresh the auth context when the change targets the signed-in user, so the sidebar and page gates update immediately.
- Show a short note that another user has to sign in again (or refresh) before a change reaches their session.

### Effective-access clarity
- Each row gets an "Effective access" summary column: what the user actually gets (all companies / list of companies with role / no access), computed the same way the app computes it. This makes it obvious when a change did or didn't take.

## Technical notes

- `src/lib/auth-context.tsx`: keep `roles` (global) and `companyRoles` separate; add an `activeCompanyId` input so the derived flags are scoped. Since company scope lives in `CompanyProvider` (which renders inside `AuthProvider`), expose a scope setter from auth or move the derived flags into a small `useEffectiveRole()` hook that reads both contexts; consumers (`app-shell`, `clients`, `projects`, `_authenticated`) switch to that hook.
- `src/routes/_authenticated/users-access.tsx`: role list, non-destructive platform update, reload-after-write, `refresh()` from `useAuth` when editing self, effective-access column.
- No schema change required. Optional follow-up (not in this plan): align the `user_company_access` role CHECK constraint with the four supported roles once legacy rows are migrated.
