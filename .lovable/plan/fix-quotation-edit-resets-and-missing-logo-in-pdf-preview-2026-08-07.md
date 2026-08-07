# Fix quotation edit resets and missing logo in PDF preview

## Problem 1 — edits reset while the quote dialog is open

The quote dialog fills its fields from the quote being edited inside an effect that also
re-runs whenever the companies list object changes. Because company/client/project data
reloads in the background (hydration from the database), that list gets a new identity and
the effect fires again mid-edit, overwriting whatever was typed with the saved values.

A second effect keeps the selected company/client/project "reconciled" with the available
options. While the lists are still loading (momentarily empty or not yet scoped), the current
selection is not found and gets cleared or replaced with the first item.

Fix:
- Initialise the form once per dialog opening (keyed on open + the quote's id), not on every
  data refresh.
- Treat the option lists as loading while they are empty, so the reconcile step never clears a
  valid selection during hydration; only clear a selection once the lists have actually loaded
  and the value is genuinely gone.

## Problem 2 — company logo missing in the document preview

Logos are stored as private storage references (`storage:bucket/path`), not direct URLs.
The document preview inserts that raw value into the image tag, so nothing renders.

Fix:
- Resolve the company logo to a usable signed URL before building the preview HTML, and pass
  that resolved URL into the preview, print, and PDF export paths so the logo appears in all
  three.

## Technical notes

- `src/routes/_authenticated/quotations.tsx`: change the hydrate-form effect dependency to
  `[open, editing?.id]`; pass `loading` to the three `useReconciledSelection` calls based on
  empty option lists (and on a still-empty companies list for the client/project pickers).
- Apply the same dependency fix to the invoice dialog if it shares the pattern
  (`src/routes/_authenticated/invoices.tsx`) so the same bug does not remain there.
- `src/components/document-preview.tsx`: accept an optional resolved `logoUrl` in the HTML
  builders; the dialog resolves `company.logoUrl` via the existing storage helper
  (`useFileUrl`) and passes it to `buildHTML` / `buildPrintableDocument` /
  `buildDocumentHTML`. Callers that generate PDFs outside the dialog resolve it the same way
  before calling the builder.
