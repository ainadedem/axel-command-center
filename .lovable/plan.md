# Billing email optional + correct quotation series for all users

## 1. Billing email no longer mandatory

On the client form, "Billing email" is currently required and blocks saving. Change it to optional:

- Remove the required marker on the field label.
- Only validate the format when something is typed (empty = valid).
- Error text becomes "Enter a valid email address" and shows only for a malformed entry.

Address stays as it is today.

## 2. Quotation numbers not following the real company series

Confirmed cause (read from the code, not guessed): the dialog fills the number twice.

1. When the dialog opens it sets a number computed **only from the quotations the signed-in user can see** (a sales user sees only their own).
2. A second effect then replaces it with the correct company-wide number fetched from the server — but that effect only re-runs when the selected company or issue date *changes*.

So the first time a user opens the "New quotation" dialog the server-side number is applied, but every subsequent open with the same company and date keeps the stale, visibility-limited number. For a sales user whose visible list is small, that produces numbers far behind the real series (e.g. restarting at 001 instead of continuing at 535).

Fix:

- Re-run the company-wide number resolution every time the dialog opens for a new quotation, not just when company/date change.
- Keep the locally computed value only as an instant placeholder until the server answer arrives.
- Do not overwrite a number the user has edited by hand in the open dialog.
- Apply the exact same fix to the invoice dialog, which has the identical effect and the identical stale-number behaviour.

## Technical notes

- `src/routes/_authenticated/clients.tsx`: drop `!email.trim()` from the `missing.email` rule, unwrap `RequiredLabel` on the billing-email label, adjust the message.
- `src/routes/_authenticated/quotations.tsx` and `src/routes/_authenticated/invoices.tsx`: add `open` and `editing?.id` to the `nextNumberAsync` effect dependencies, and track a "user edited the number" flag so the async result does not clobber manual input.
- No database or numbering-logic change: `document_numbers` (server-side, company-wide) already returns the full series, and the grants for it are in place.
