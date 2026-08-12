# Fix quotation numbering for sales users

## Confirmed cause

Logia’s database quotation series currently ends at `DEV/LOG/08-26/534`, so the next suggestion must be `DEV/LOG/08-26/535`.

The quotation dialog already requests the company-wide series each time it opens, but `primeNumbering` sends the UI/local company ID (for example `log`) to `document_numbers`, whose company parameter requires the database UUID. That request fails; the error is silently discarded; numbering then falls back to quotations loaded in the browser. A sales user only has their permitted subset, so their suggested number does not follow the actual series.

## Fix

- Resolve the selected local company ID to its database UUID before calling `document_numbers`.
- Keep the numbering cache keyed by the local company ID so it continues to merge correctly with the app’s locally mapped documents.
- Stop silently treating a failed company-wide lookup as a successful empty series; expose a safe failure result in development/logging and prevent stale cached data from masquerading as a fresh result.
- Preserve the current behavior that refreshes the series whenever the new-quotation dialog opens and does not overwrite a number manually edited by the user.
- Apply the same ID resolution to invoice and purchase-order numbering because they use the same shared function.

## Verification

- Verify the company-wide lookup receives the correct UUID and returns all Logia quotation numbers for a sales session.
- Verify a new Logia quotation suggests `DEV/LOG/08-26/535` from the current data.
- Verify changing company/date and reopening the dialog still refreshes the suggestion.
- Verify manually entered numbers are not overwritten and duplicate detection still works.

## Technical notes

- Update `src/lib/numbering.ts` to use the existing local-to-database company ID mapping from the data sync layer before invoking `document_numbers`.
- No database migration or numbering-format change is required; the database function already returns the complete authorized company series.
