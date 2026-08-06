# Fix team members disappearing per company + collapse sidebar menus by default

## What's wrong today

**1. Team members vanish outside the group view (confirmed)**

When the app loads data for a single company (or for a user who isn't a group/super admin), the team list is explicitly emptied instead of being loaded. Only the "All companies" group view loads people. That's why:
- a company view shows no team members, even though the database holds 63 of them (30 marked visible in all companies, 26 assigned to a company, 7 unassigned);
- the Payroll salary register can't attach anyone, since its person picker reads that same empty list.

**2. Sidebar sections are all expanded on load**

Every navigation group opens by default, regardless of where the user is.

## What will change

**Team data loading**
- Always load team members and sales members, in every scope.
- In a single-company view, load people who are marked "All companies" plus people assigned to that company — unassigned people stay out of company views (as designed) and remain visible in the group view.
- The Team page keeps its current filtering behaviour; it will simply have data to show again.

**Payroll**
- The salary-register person picker will list people available for the selected company (all-companies people + that company's people), sorted by name, so payroll entries can be created from a company view.
- The company picker keeps its current behaviour.

**Sidebar**
- Each navigation section starts collapsed; only the section containing the current page is expanded.
- Navigating to a page inside a collapsed section auto-expands that section; manual open/close still works and is respected while on the same page.

## Technical notes

- `src/lib/db-sync.ts` — `hydrateExtras`: remove the `scope.mode === "all"` gate that calls `teamMembersStore.replaceAll([])`; for scoped mode query `team_members` with `is_global.eq.true` OR `company_id.in.(...)`, and load `sales_members` for the resulting member ids.
- `src/routes/_authenticated/payroll.tsx` — `RegisterDialog`: derive the member options from `companyId` (`m.companyId === undefined || m.companyId === companyId`) and sort by name.
- `src/components/app-shell.tsx` — `SidebarSection`: initialise `open` from `hasActive` and sync it with an effect when `hasActive` flips to true on route change.

No database migration and no schema change are needed.
