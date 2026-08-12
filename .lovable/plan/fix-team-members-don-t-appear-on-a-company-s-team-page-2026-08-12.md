# Fix: team members don't appear on a company's Team page

## What's happening

The people are in the database (Logia has 10, Axiom has 16, plus 2 marked "All companies"), and the app asks for the right ones. The database access rule is what blocks them.

Today the rule says a non-group-admin can only see a person if that person has a **payroll salary record in one of their companies**. It completely ignores the person's own company assignment and the "All companies" flag. So for anyone who isn't a group/super admin, a company's Team page comes back empty (or shows only whoever happens to be on payroll).

## The fix

Replace the view rule on team members so someone can see a person when any of these is true:

- they are a group/super admin (unchanged), or
- the person is marked "All companies", or
- the person is assigned to a company the viewer has access to, or
- the person has a payroll record in a company the viewer has access to (kept, so nobody loses visibility they have today).

The same access logic is applied to the sales-team records so sales role badges keep matching the visible people.

No app code, no schema change — one migration that redefines the read policies.

## Technical notes

- Migration drops and recreates the `SELECT` policy `Users view team_members in their companies` on `public.team_members`:
  `app_private.is_group_admin(auth.uid()) OR is_global OR company_id IN (select company_id from user_company_access where user_id = auth.uid()) OR EXISTS (existing salary_register join)`.
- Same treatment for the `sales_members` read policy: visible when the linked `team_members` row is visible under the rule above.
- After applying, verify from a company-admin session that `/team` in a company scope lists that company's people plus the "All companies" ones.
