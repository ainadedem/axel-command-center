# Add users from the Users & Access page

## What you get

An "Add user" button at the top of Users & Access (visible to group/super admins only) opening a dialog with:

- Email (required)
- Full name
- Platform role: none / group admin / super admin (super admin only can pick these)
- Per-company access: one role picker per company (No access / Company admin / Finance / Sales / Viewer)
- Creation mode:
  - Send invitation email — the person sets their own password from the link
  - Set a temporary password — you type a password and hand it over; account is active immediately

On save the account is created, the chosen roles are written, and the table reloads with the new row. Errors (email already exists, weak password) are shown in the dialog without closing it.

## How it works

Account creation needs privileged backend access, so it runs server-side, not from the browser:

- New `src/lib/users-admin.functions.ts` with a `createAppUser` server function protected by the auth middleware.
- The handler first verifies the caller actually holds group admin or super admin; a caller trying to grant a platform role must be super admin. Only then does it load the admin client.
- It creates the auth user (invite link or password), then inserts the platform role row and the per-company access rows. If role writes fail, the created account is removed so no half-provisioned user is left.
- The profile row is created automatically by the existing signup trigger.

## Technical notes

- `src/routes/_authenticated/users-access.tsx`: add the dialog + button, call the server function via `useServerFn`, reuse the existing `load()` to refresh.
- Reuses existing role constants (`ASSIGNABLE_ROLES`, `PLATFORM_ROLES`) so the picker stays aligned with what the security rules enforce.
- Admin client is imported inside the handler only, after the caller check.
- No schema change required.
