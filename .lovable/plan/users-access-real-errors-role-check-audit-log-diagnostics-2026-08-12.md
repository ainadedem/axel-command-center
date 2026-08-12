# Users & Access: real errors, role check, audit log, diagnostics

## Current state

- `src/lib/users-admin.functions.ts` authorizes with two `has_role` calls, then throws plain
  strings: `Forbidden: administrators only.` when both come back false, and
  `Could not verify your role: …` when the lookup itself errors. The Add-user dialog
  (`src/routes/_authenticated/users-access.tsx:487`) already shows `err.message`, so what you see is
  the server's own generic sentence — there is no detail behind it explaining *which* check failed.
- There is no table recording user-creation or role-assignment attempts.
- `public.has_role` is `SECURITY DEFINER` and only returns true when `_user_id = auth.uid()`, so the
  check depends on the bearer token reaching the server function.

## What will be built

### 1. Precise creation errors
Server-side, replace the single "administrators only" throw with a structured failure that names the
failing condition: no bearer identity, role lookup denied/errored (including the database message),
role rows found but none admin, or platform-role grant attempted by a non-super-admin. The dialog
shows that sentence verbatim. Nothing sensitive is exposed: no keys, no other users' data, no raw
stack traces — only the caller's own role facts and the database error text for their own lookup.

### 2. "Check my access" button
A new read-only server function returns, for the caller: the user id and email the server sees, the
platform roles it can read, whether super/group admin resolves true, and whether the role lookup
errored. A **Check my access** button in the Users & Access header calls it and shows a short verdict
("Session recognised as super administrator", or the specific reason it is not).

### 3. Audit log
A new `user_admin_audit` table records every attempted user creation and role assignment: acting
user, action, target email/user, company context, requested roles, outcome (success/failure) and the
error message on failure. Written from the server function with the privileged client so a failed
attempt is still recorded. Readable only by super/group admins. A collapsible **Recent activity**
list on the Users & Access page shows the latest entries.

Role changes made inline on the page (platform role select, per-company role select) are logged too,
through a small server function so the log cannot be forged from the browser.

### 4. Permission diagnostics panel
An expandable panel on Users & Access that runs the same checks the create flow runs and displays
them as a pass/fail checklist:

```text
Bearer token reached the server        OK
Server sees user                       you@example.com
public.has_role executable             OK
super_admin role row                   FOUND
group_admin role row                   not found
Platform-role grant allowed            yes
```

Each failing line carries the exact database error so the cause is unambiguous.

## Technical notes

- Migration: `public.user_admin_audit` (actor_user_id, action, target_email, target_user_id,
  company_id, requested_role, success, error_message, created_at) with grants, RLS enabled,
  admin-only read, and no client insert path (service role writes only).
- Files: `src/lib/users-admin.functions.ts` (audit writes, structured errors, new
  `checkMyAdminAccess` and `logRoleChange` functions), `src/routes/_authenticated/users-access.tsx`
  (button, diagnostics panel, recent-activity list).
- No change to how permissions are enforced — only to how they are reported and recorded.
