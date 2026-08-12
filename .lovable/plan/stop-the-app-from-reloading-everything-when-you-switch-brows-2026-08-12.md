# Stop the app from reloading everything when you switch browser tabs

## What happens today

When you leave the tab and come back, the auth client re-checks the session and announces a
"signed in" event, even though nothing about your login changed. The app treats that as fresh
auth state: it stores a brand-new session object, re-reads your profile and roles, and hands a
new context value to every screen. Everything downstream re-renders and re-initialises, so open
dialogs and half-filled forms lose what you typed.

Confirmed in the code:
- `src/lib/auth-context.tsx:60-75` — every `SIGNED_IN` / `INITIAL_SESSION` event calls
  `setSession(s)` and re-fetches profile + roles, with no check that the user is unchanged.
- `src/lib/auth-context.tsx:93-106` — the context value object is rebuilt on every render, so
  every consumer re-renders even when nothing actually changed.
- `src/lib/company-context.tsx:305-420` — the bootstrap/hydration effects re-run whenever auth
  state churns, which reloads company, client, project and financial data mid-edit.

## The fix

1. **Ignore no-op auth events.** Keep a reference to the current user id and access token. If a
   `SIGNED_IN` / `INITIAL_SESSION` event carries the same user, update nothing: no `setSession`,
   no profile/role refetch. Only a real user change (sign-in as someone else, sign-out) updates
   state. `TOKEN_REFRESHED` stays ignored as it already is.
2. **Keep roles and profile stable.** When re-reading roles, only replace the array if the
   contents actually differ, so identity-based effects don't fire.
3. **Memoise the auth context value** so consumers only re-render on real changes.
4. **Guard the company bootstrap** so it never re-runs for the same user + admin flag, and its
   dependent data hydration doesn't restart on a tab switch.

## Result

Switching tabs and coming back leaves the page exactly as it was: open dialogs keep their
values, tables keep their state, and no background reload wipes an in-progress form. Real
sign-in, sign-out, and company-scope changes still refresh data as before.

## Technical notes

- Files touched: `src/lib/auth-context.tsx`, `src/lib/company-context.tsx`.
- No database, RLS, or backend changes.
- Verification: open a quotation/invoice dialog, fill fields, switch tabs for ~30s, return, and
  confirm the values are intact and no re-hydration logs appear in the console.
