# Logia document numbering format

Set Logia's invoice and quote numbering to a fixed house format instead of inferring it from old documents.

## Format

- Invoices: `INV/LOG/MM-YY/NNN` (e.g. `INV/LOG/08-26/001`)
- Quotes: `DEV/LOG/MM-YY/NNN` (e.g. `DEV/LOG/08-26/001`)
- Month/year come from the document's issue date (today's date when creating).
- The 3-digit sequence is continuous — it never resets at month or year change; it continues from the highest sequence ever used for that company and kind.
- Duplicates stay blocked: if a number is already taken, the next free one is suggested.

## Technical notes

- In `src/lib/numbering.ts`, add a per-company format override keyed to Logia, with prefixes `INV` (invoice) and `DEV` (quote), pattern `PREFIX/LOG/MM-YY/NNN`.
- `nextNumber(kind, companyId, issueDate?)` gains an optional issue date; when the company has an override, build the number from the override (month/year from that date, sequence = max trailing group across existing docs of that kind + 1), then run the existing collision loop.
- Other companies keep the current inferred behaviour unchanged.
- Callers in `invoices.tsx`, `quotations.tsx`, and `billing.tsx` pass the document's issue date where available.
- Existing Logia documents are left as-is; only newly created ones use the new format.
