# Quotation numbering follows the last written format

## What's wrong today

Quote numbers come from `src/lib/numbering.ts`. It picks the "template" document as the one whose **last group of digits is the biggest number**, then adds 1 to that group. That has two consequences:

- If a company mixes formats (for example `QUO-26-0007` and `DEV-LOG/07-26/003`), the template chosen is whichever happens to hold the biggest trailing number — not the one you wrote most recently. A newly adopted format can be silently abandoned.
- Year/month tokens inside the number are never refreshed, so a document created in a new month keeps the old month token.

The same helper drives invoices and purchase orders, so the behaviour is identical there.

## What will change

Numbering will follow **the most recently written document** of that kind for that company:

1. Pick the latest quote by issue date, breaking ties by the order it was added (the last one written wins).
2. Reuse that quote's exact writing model: prefix, separators, padding width, and any year/month tokens.
3. Refresh date tokens to the new document's issue date (a 2-digit year `26`, a 4-digit year `2026`, and a `MM` month segment are recognised), then continue the sequence from the highest number **among documents sharing that same model** — so switching format restarts cleanly at `...001` instead of jumping to an unrelated high number.
4. Keep the existing collision guard: if the produced number already exists, it bumps until it is free.
5. If the company has no prior document of that kind, keep today's fallback (`QUO-<yy>-0001`).

Behaviour that stays the same:
- The number field remains editable, and the duplicate warning stays.
- Editing an existing quote never renumbers it.
- Invoices and purchase orders inherit the same improved rule (they already call the same helper).

## Technical detail

- `src/lib/numbering.ts`: replace the "largest trailing number" template selection with latest-document selection. Add a small pattern extractor that splits a number into `prefix + sequence` and tags date-like segments, plus a `sameModel(a, b)` comparison (identical structure once digits are masked) used to scope the max-sequence search. `nextNumber(kind, companyId, issueDate?)` gains an optional issue date for token refresh, defaulting to today.
- `src/routes/_authenticated/quotations.tsx`: pass the quote's issue date into `nextNumber` when creating and when the company changes. Invoices/billing/PO call sites keep working unchanged.
- No database or schema changes.
