# Verify the Logia ledger import — findings and fix

## What I checked

I compared the file you just uploaded against the ledger stored in the app and against the backend.

## Result 1 — the ledger itself is complete

- The uploaded file (`...Grand_Livres-2.csv`) is byte-for-byte identical to the one already imported (same checksum). Nothing new to import.
- It contains **2,826 ledger lines**, and the app holds **exactly 2,826 lines** across **1,263 vouchers**.
- Totals match to the cent: débit 1,895,490,182.49 = crédit 1,895,490,182.49 in both the file and the app.
- Every voucher balances (0 unbalanced), date range 1 Jan – 30 Jun 2026.
- One cosmetic source quirk: the last row (30 Jun 2026, AXIOM UNLIMITED, 1,500,000 affiliation fee) has a malformed piece number `0.52` and a shifted extra column `A913` in the CSV. The app stored it correctly under piece `056/108` with both sides of the entry, so the amount is right; only the piece reference differs from the raw file.

**So no ledger lines are missing.**

## Result 2 — the real gap: Logia's derived data never reached the backend

Backend row counts today:

```text
Axiom Unlimited   2,292 transactions   12 invoices   1 account
Logia Madagascar      0 transactions    0 invoices   4 accounts
Winford Next          1 transaction     0 invoices   1 account
```

Logia's clients, suppliers, invoices and transactions are derived from the Grand Livre in the browser and shown on the pages, but they exist **only locally** — the backend has zero Logia transactions and invoices. Anyone signing in on another browser or device sees an empty Logia.

Cause: the one-time seed push is gated by a per-user flag (`axel.finSeedPushed…v3`) plus a global "are there any accounts at all?" check. That flag is already set and other companies do have accounts, so after Logia's rows were cleared server-side the push never re-ran.

## Proposed fix

1. Make the seed-push guard **per company** instead of global: before skipping, check whether each seeded company actually has financial rows in the backend, and push only the companies that are empty. This closes the class of bug, not just the Logia instance.
2. Bump the seed flag version so the check re-runs once for existing users.
3. Push Logia's derived set (accounts, categories, clients, suppliers, invoices, transactions) to the backend, then re-verify the counts with a query and confirm ledger totals match the derived transaction totals.

## Technical notes

- `maybePushSeeds` in `src/lib/company-context.tsx` holds the flag logic to change.
- `pushLocalFinancialSeed` / `pushLocalSeed` / `pushLocalExtrasSeed` in `src/lib/db-sync.ts` already upsert by id, so a re-push is idempotent and won't duplicate Axiom's rows.
- No change to `src/lib/logia-grand-livre-seed.json` — it is already correct and matches the uploaded file.
