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
2. Keep the existing database policies and team-page filter unchanged because they already express the intended company scope.
3. Verify startup and company switching no longer erase the hydrated team data, and confirm Logia shows its 10 assigned members plus global members for an authorized non-platform-admin session.

## Technical scope

- Frontend data hydration/store cleanup only (`src/lib/company-context.tsx`).
- No schema, data, role, or RLS changes.
