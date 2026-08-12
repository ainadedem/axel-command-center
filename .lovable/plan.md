# Fix: app stuck on the loading screen after sign-in

## What's happening

The published app signs you in, then hangs on "Loading your workspace access and data...".
Sign-in itself is fine: the login page renders and the auth check always finishes.

The stall is in the workspace bootstrap that runs right after sign-in
(`src/lib/company-context.tsx:334-433`). Confirmed in the code:

- The bootstrap marks itself as "already run" (`bootstrapKeyRef`) at line 343, **before** doing
  any work. If the run then aborts, nothing ever retries — the screen stays on the spinner for
  good.
- Several paths abort without ever finishing: line 389 and line 393 `return` when the company
  query errors, and any thrown error from the access query (line 361), the seed push (line 404),
  or hydration escapes the function entirely. In all of those cases `bootstrapReady` is never
  set to `true`, and `src/components/app-shell.tsx:456` keeps rendering the loading screen
  forever.
- The React effect cleanup sets `cancelled = true` on the first pass; because the key is already
  claimed, the second pass exits immediately at line 342 and no bootstrap ever completes.

So any single backend hiccup or permission error on the access/companies read — including one
caused by a recent policy change — turns into a permanent loading screen with no error shown.

## The fix

1. **Never leave the app in a loading state.** Wrap the whole bootstrap in try/catch/finally so
   `accessLoading`, `dataLoading` and `bootstrapReady` are always resolved, whatever happens.
2. **Only claim the bootstrap key on success.** Reset it when a run fails or is cancelled, so the
   next attempt actually runs instead of short-circuiting.
3. **Surface failures instead of hiding them.** If access/companies loading fails, render the
   shell with an inline "Couldn't load your workspace" message and a Retry button rather than an
   endless spinner, and log the underlying error to the console.
4. **Treat the company queries as non-fatal.** An error there should fall back to whatever is
   already known and continue to the app, not abort the boot.
5. **Verify the actual backend error.** Check the access/companies/profiles reads for a signed-in
   user against the current policies, and fix the policy if one of those reads is now denied or
   erroring after the recent visibility changes.

## Result

Sign-in lands on the dashboard. If the backend does fail, you get a clear message and a Retry
button instead of an infinite loading screen.

## Technical notes

- Files touched: `src/lib/company-context.tsx`, `src/components/app-shell.tsx`.
- A database policy fix is included only if step 5 shows one of the reads is failing.
- Verification: sign in on the published site and confirm the dashboard renders; then simulate a
  failed access read and confirm the error state with Retry appears.
