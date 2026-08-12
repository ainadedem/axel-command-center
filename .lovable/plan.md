# Continuous quotation numbering across months

Quotation (and invoice) sequences must never restart when the month changes. Only the month/year part of the reference changes; the counter keeps climbing.

## Intended behaviour

- Logia quotes: `DEV/LOG/MM-YY/NNN`, invoices: `INV/LOG/MM-YY/NNN`.
- Example: last quote `DEV/LOG/08-26/532` -> first September quote is `DEV/LOG/09-26/533`, not `/001`.
- The counter is per company and per document kind, shared across all months and years.
- Duplicates stay blocked; if a suggested number is taken, the next free one is proposed.
- Numbers stay editable by hand.

## What changes

- In `src/lib/numbering.ts`, compute the next sequence from the sequence segment of existing numbers only (the group after the final `/`), ignoring the `MM-YY` digits so a month rollover can never lower the counter.
- Match numbers of the same document kind for the company regardless of prefix, so historical `FAC-LOG/...` invoices and `QUO-...` quotes still count toward the highest sequence.
- Widen the sequence padding automatically once the counter passes 999 (`532` -> `999` -> `1000`), instead of truncating.
- Keep the existing collision loop, but make it bump the sequence segment only, never the month/year.
- Companies without a fixed house format (Axiom `INV-26-0001`, `QUO-26-0001`) keep today's inferred behaviour.

## Verification

Confirm from the current data that the next Logia quote suggestion is `DEV/LOG/08-26/533` today and `DEV/LOG/09-26/533` for a September issue date, and that the next Logia invoice continues from the highest existing invoice sequence rather than restarting.
