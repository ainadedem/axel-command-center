# Fix "administrators only" when adding a user

## What's happening

Your account does hold the super admin role — the check itself is broken, not your access.

When the Add user dialog submits, the backend asks the database "does this caller hold super admin / group admin?" through the `has_role` helper. A past security cleanup left two copies of that helper: the private one signed-in users may run, and the public one the app actually calls — and the public one no longer allows signed-in users to run it. The call fails, the backend reads the failure as "no role", and returns "Forbidden: administrators only."

This affects any signed-in caller, including super admins.

## The fix

1. Migration: restore permission for signed-in users to run the public `has_role` helper (the helper already only answers about the caller's own roles, so this grants no extra visibility).
2. In `createAppUser`, stop treating a failed role lookup as "not an admin": if the lookup errors, surface that error instead of a misleading permission message, so a future regression is diagnosable.

## Verification

- Query the helper's permissions after the migration to confirm signed-in users can execute it.
- Create a test user from Users & Access with the invite mode and confirm the row appears in the table, then remove it.

## Technical notes

- `public.has_role(uuid, app_role)` currently has EXECUTE only for `postgres` and `service_role`; `app_private.has_role` still has it for `authenticated`. PostgREST only exposes `public`, so the RPC in `src/lib/users-admin.functions.ts` is the one failing.
- Migration: `GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;`
- No schema or RLS policy changes; RLS policies referencing `public.has_role` are unaffected (they run as the table owner).
