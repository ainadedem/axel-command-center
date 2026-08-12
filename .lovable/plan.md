# Fix: stuck on loading after signing in as a different user

## What's happening

After signing in with another account, the app stays on "Loading your workspace access and data...".
Two things in the startup sequence explain it, both confirmed in the code:

1. **The first login of any new user replays the whole local seed push.**
   `maybePushSeeds` (`src/lib/company-context.tsx:261-313`) is gated on `localStorage` flags keyed by
   user id (`axel.seedPushed.<userId>.v4`, …). A different user on the same browser has none of those
   flags, so the bootstrap runs a per-company row-count probe for clients, accounts, transactions,
   invoices and opportunities, then pushes the entire local seed (including the ~4,000-row Logia
   ledger) to the backend. This is `await`ed in the middle of the bootstrap (line 426), before
   hydration and before `bootstrapReady` is set, so the spinner stays up for as long as it takes —
   and for a restricted (non-admin) user most of those writes are rejected by row-level security,
   so it is slow work that achieves nothing.

2. **A cancelled bootstrap can permanently claim its key.**
   `bootstrapDoneRef` (line 335) is never reset at the start of a run. It stays `true` from a
   previous completed run, so the cleanup at line 470 skips releasing `bootstrapKeyRef`. If the run
   for the new user is cancelled (the roles/`isGroupAdmin` flag arrives asynchronously right after
   sign-in and flips the effect dependencies) and the same key comes back, the effect returns early
   at line 357 and `bootstrapReady` is never set to `true`.

## The fix

1. **Stop pushing local seed data on sign-in.** All company data already lives in the backend. Remove
   the `maybePushSeeds` call from the bootstrap path so signing in only reads. (Keep the seed helpers
   available for an explicit admin-triggered repair, not as a login side effect.)
2. **Make bootstrap cancellation safe.** Reset `bootstrapDoneRef` to `false` at the start of every
   run and release `bootstrapKeyRef` whenever a run is cancelled, so the key can never stay claimed
   by a run that never finished.
3. **Never hang forever on a read.** Wrap the access/companies/hydration awaits in a bounded timeout;
   on timeout, finish the bootstrap with the "Couldn't load your workspace" screen and Retry rather
   than an endless spinner.
4. **Reset per-user state on user change.** When the signed-in user id changes, clear the stored
   company scope if the new user has no access to it, so the new session starts on a company they can
   actually see.

## Result

Signing in as any user — admin or restricted — lands on the app in a couple of seconds. No hidden
data upload on first login, and any backend failure shows a clear message with Retry instead of a
frozen loading card.

## Technical notes

- Files touched: `src/lib/company-context.tsx` (bootstrap effect, seed call, scope reset).
- No database, RLS, or schema changes.
- Verification: sign in as a sales-scoped user in a fresh browser profile, confirm the dashboard/
  quotations screen renders, and confirm the console shows no `pushLocalSeed` activity.
