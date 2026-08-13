# Fix the empty Logia Team page

## Confirmed cause

- Logia has 10 company-assigned team members in the database, plus one global member.
- The active database read policy allows signed-in users with Logia access to read those members.
- During workspace startup, `hydrateExtras` correctly loads the scoped team members. Immediately afterward, `restrictLocalStores` clears the entire team and sales-member stores for every non-platform-admin session, so the Team page receives an empty list.

## Implementation

1. Replace the blanket team-store clearing in `restrictLocalStores` with company-aware filtering:
   - retain members assigned to an accessible company;
   - retain members marked “All companies”;
   - exclude unassigned and inaccessible-company members;
   - retain sales-member records only when their linked team member remains visible.
2. Keep the existing team-page company filter unchanged because it already expresses the intended scope.
3. Verify startup and company switching no longer erase the hydrated team data, and confirm Logia shows its 10 assigned members plus global members for an authorized non-platform-admin session.

## Only admins can change team member info

Everyone with access to a company can see its people, but editing is admin-only.

- Team page: hide the "New", edit and delete controls for non-admins, so the page is read-only for finance, sales, project managers and viewers.
- Access rules: today only platform (group/super) admins may create, edit or delete people. Extend this so a company admin can also manage the people of a company they administer, plus "All companies" people stay platform-admin only. Everyone else stays read-only at the database level, so the restriction holds even outside the UI.

## Technical scope

- Frontend: `src/lib/company-context.tsx` (store cleanup) and `src/routes/_authenticated/team.tsx` (admin-gated controls via `useEffectiveRole`).
- Database: one migration replacing the insert/update/delete policies on `team_members` (and matching `sales_members`) to allow platform admins and company admins of the member's company.
- No schema or data changes.
