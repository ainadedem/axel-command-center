# Searchable account picker in the journal entry form

Replace the "Compte PCG" dropdown in the new/edit journal entry dialog with a type-to-search field, so you can type a code (e.g. `411`) or part of a label (e.g. `TVA`, `salaires`) instead of scrolling the full PCG list.

## Behaviour

- Clicking the field opens a small panel with a search box focused right away.
- Typing filters the PCG accounts by code prefix or label text, live.
- Arrow keys move through results, Enter selects, Escape closes.
- Once selected, the field shows `code — label` exactly like today.
- No match shows "Aucun compte trouvé".
- Everything else in the dialog (libellé, débit, crédit, balance check, saving) is unchanged.

## Technical notes

- New component `src/components/pcg-account-select.tsx`: Popover + Command (both already in the project) over `pcgAccounts` from `src/lib/pcg`, with props `value` / `onChange` and a compact `h-8` trigger to match the row height.
- `src/routes/_authenticated/journal.tsx` line ~218: swap the `Select`/`SelectItem` block for the new component; keeps `updateLine(i, { account: v })` as-is.
- Filtering matches code prefix or case-insensitive label substring, same rule as the Plan comptable search.
