# Fix: auth loading never finishes after sign-in

## Confirmed cause

The persistent screen is the plain **“Loading…”** state from the authenticated route, so the app never reaches the workspace bootstrap.

In `src/lib/auth-context.tsx`, the initial session chain returns `loadUserData(...)`. Its final `setLoading(false)` therefore waits for all profile, global-role, and company-access requests to finish. One stalled backend request keeps the entire authenticated app blocked indefinitely.

## Changes

1. **Separate session readiness from user-data loading**
   - Resolve the main auth `loading` state as soon as the initial session lookup completes.
   - Load profile, roles, and company access independently so those reads cannot hold the route gate open forever.

2. **Make user-data loading bounded and resilient**
   - Add a timeout around profile/role/access loading.
   - Handle each read’s error explicitly and preserve safe defaults rather than waiting forever or silently treating failed reads as valid data.
   - Prevent stale requests from an earlier session from updating the current user’s state.

3. **Avoid premature sales redirects**
   - Expose a separate access/roles loading state.
   - Delay role-based route redirection until access resolution finishes, while still allowing the authenticated layout to render.

4. **Add a recoverable auth failure state**
   - Replace an indefinite auth spinner with an actionable message and retry/sign-out controls if the initial session lookup itself exceeds its timeout.

## Technical scope

- Update `src/lib/auth-context.tsx` to split session initialization from user-data hydration and add bounded request handling.
- Update `src/routes/_authenticated.tsx` to distinguish session loading, access loading, and auth failure states.
- Reuse the existing design-system button component for recovery actions.

## Verification

- Sign in and confirm the dashboard opens without remaining on “Loading…”.
- Simulate a stalled profile/role/access request and confirm the route still resolves to a recoverable state.
- Confirm a sales user is redirected only after roles load, while an admin retains normal dashboard access.
- Confirm sign-out and a fresh sign-in clear all prior profile and role state.
