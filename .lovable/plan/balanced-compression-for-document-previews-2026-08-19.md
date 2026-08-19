# Balanced compression for document previews

Today, when a quotation/invoice/PO is compressed (auto-fit to one A4 page, density slider, or manual scale), every part of the sheet shrinks by the same factor. That makes the company identity block — logo, header, "From" details, legal identifiers (NIF/STAT), payment block — become uncomfortably small at strong compression.

## Goal

Keep the company details legible at a readable floor, and let the line-item content (descriptions, the secondary "Details" text, row padding, table spacing) absorb most of the shrinking instead.

## Behaviour

- Two scaling tiers instead of one:
  - Identity tier (logo, document title, number, From / Bill To blocks, legal + tax metadata, payment details, footer): scales gently and never drops below a readable floor (about 90% of the normal size).
  - Content tier (line-item table: description, Details column, unit/qty/rate text, cell padding, row spacing): takes the remaining compression, down to a lower floor so text stays readable but compact.
- When the exporter still cannot fit one page after the content tier bottoms out, the identity tier is allowed to shrink slightly further (down to a hard floor) before the whole sheet is scaled uniformly, as today.
- The manual density slider keeps the same range, but applies through the same two-tier curve so the preview and the exported PDF stay identical.
- The existing amber "compressed to fit" badge keeps working and reflects the effective content scale.

## Technical notes

- `src/components/document-preview.tsx`: the `px()` helper currently multiplies every size by a single `scale`. Split into `pxIdentity()` (gentle curve with a floor) and `pxContent()` (aggressive curve) and apply each to the relevant CSS rules in `buildHTML`. Line-item `.sub` / `.rt` sizes, `td`/`th` padding and table font use the content curve; `.row`, `.grid`, `.party`, `.legal`, `.taxmeta`, `.paycard`, `.footer` and the logo dimensions use the identity curve.
- `src/lib/a4-fit.ts`: expose the same two-tier mapping so the fit measurement and the export pipeline compute identical geometry; the auto-fit search iterates on the content scale first, then the identity scale.
- `src/lib/pdf-render.ts` / `pdf-export.ts`: no behaviour change beyond consuming the shared mapping, so export matches the preview.
- Extend `src/lib/__tests__/a4-fit.test.ts` with a case asserting that under heavy compression the identity font size stays at or above the readable floor while content shrinks further.
