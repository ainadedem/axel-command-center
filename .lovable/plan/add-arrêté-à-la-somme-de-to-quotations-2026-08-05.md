# Add "Arrêté à la somme de ..." to quotations

## Goal
Show the French legal amount-in-words line on quotations, the same way it already appears on invoices.

## Change
In `src/components/document-preview.tsx`, inside the totals block:

- Currently the `arrete` line only renders when `doc.kind === "invoice"`.
- Add the same line for `doc.kind === "quote"`, placed right under Total TTC (quotes have no "Paid to date" / "Balance due" rows, so the line ends the totals block).
- Reuse the existing `amountInFrench(totalTTC, doc.currency)` helper and the existing `.arrete` CSS class — no new styling or utilities.

Purchase orders stay unchanged.

## Verify
Type-check, then open a quotation preview and confirm the italic line reads "Arrêté à la somme de ... ." under Total TTC.
