# Bulk edit upgrade — invoices & quotations

Today the bulk edit dialog only changes **client** and **project**. This expands it into a full multi-field batch editor, keeping the existing one-step undo and per-document activity trail.

## New editable fields

Every field keeps a "Keep current" default, so only what you touch is written.

**Dates**
- Issue date: set to a date.
- Due date (invoices): set to a date, or shift by +/- N days from each invoice's own due date.
- Valid until (quotations): set to a date, or shift by +/- N days.
- Next follow-up date (quotations): set or clear.

**Money & tax**
- Tax rate: set a VAT rate (0% / 20% / custom). Recomputes tax amount and total per document from its own lines, using the existing VAT rules.
- Global discount %: set or clear. Line totals recompute the same way the editor does.
- Currency label: change only when no payment has been recorded; documents with payments are listed as skipped.

**Document setup**
- Language: French / English.
- Bank account: pick from the accounts configured on the document's company (only offered when all selected documents share a company).
- Signer: pick a team member; marks the stamp for refresh so the next render picks it up.
- Object / subject title: set for all, or leave untouched.

**Ownership**
- Client and project (existing behaviour, unchanged).
- Quotation assignees: add, remove, or replace, capped at 3 per quote.

## How the dialog changes

- Grouped sections (Ownership, Dates, Money & tax, Document setup) instead of one flat list, so the dialog stays readable as fields grow.
- A live **change summary** at the bottom: "12 quotations will change, 3 skipped" with the reason per skipped group (paid, cancelled, different company, assignee limit reached).
- Guardrails: money and tax fields are disabled for paid or cancelled documents; those rows are skipped rather than silently written.
- Apply reports the real result — updated count, skipped count, and any failed rows with a retry action — instead of always claiming success.
- Single undo entry for the whole batch stays as it is.

## Technical notes

- `src/lib/bulk-edit.ts`: widen `BulkPatch` into a typed, discriminated field-op shape (`set` / `clear` / `shift` / `add` / `remove`), add a `resolve(row) -> patch | skip(reason)` pass so skips are explicit, and return `{ updated, skipped, failed }` instead of a bare count.
- Recomputation of tax/discount/totals reuses `src/lib/invoice-money.ts` and `src/lib/vat.ts` so bulk results match what the editors produce; no duplicated maths.
- `src/components/bulk-edit-doc-dialog.tsx`: sectioned form, doc-type aware (`invoice` vs `quote`) so invoice-only and quote-only fields render conditionally.
- Wire the richer result into the toasts in `src/routes/_authenticated/invoices.tsx` and `quotations.tsx`; bulk action bar buttons stay where they are.
- Assignee changes keep going through the existing 3-assignee validation; signer changes set `stamp_dirty` so the existing stamp refresh flow applies.
- Unit tests in `src/lib/bulk-edit.test.ts` for date shifting, tax recompute, skip reasons and undo restoring every touched field.
