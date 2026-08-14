# PDF export fidelity, stamp audit trail, one-click download

## 1. Preview and PDF must match exactly

Today the on-screen preview and the printed page place the stamp differently:

- The preview sheet is a full A4 box (210x297mm) with 22mm padding, and the draggable stamp is positioned in percent of that **whole sheet**.
- The print output uses an A4 page with a 22mm print margin, and the stamp is positioned in percent of the **content area only** (inside the margin).

So a stamp dragged near an edge lands in a visibly different spot on the exported file. The preview overlay also ignores the company stamp opacity setting, and it scales with the on-screen zoom in a way the export does not.

Fix:
- Use one shared coordinate space: stamp X/Y stay percentages of the full A4 page in both preview and export. The export wrapper gets a full-bleed positioning layer so the same percentage means the same physical millimetre.
- Apply the same stamp width formula (company stamp width x per-document scale) and the same opacity in both places; the preview zoom multiplies only the visual rendering, never the stored coordinates.
- Signature block, logo size, column widths and density scale all get resolved once and passed identically to preview and export (single args object, no duplicated math).
- Clamp stored coordinates so a stamp can never sit off-page.

## 2. Audit log for stamps, signatures and signers

Record who changed what, per document and per company:

- Per document (extends the existing document history): stamp moved or resized, stamp shown/hidden, signer changed, stamp/signature refresh applied. Each entry stores previous and new values so the timeline reads "moved stamp from 78%/85% to 62%/80%".
- Per company/user branding: stamp image uploaded, replaced or removed on a company; signature image uploaded, replaced or removed on a user profile. These are not tied to one document, so they go in a new audit table scoped to the company, readable by admins/finance.
- Both surfaces are visible: document entries appear in the existing document activity panel; branding entries appear in a small "Branding history" list on the company edit screen.

Writes are attributed to the signed-in user server-side; failures never block the underlying save.

## 3. Direct PDF download

Replace the pop-up + browser print dialog with a real file download:

- "Export PDF" renders the same HTML off-screen and produces an A4 PDF file named after the document (for example `INV-2026-014.pdf`), downloaded straight to the user's device — no pop-up, no print dialog, no pop-up blocker failure mode.
- Progress states: button shows "Preparing...", then a percentage/stage while pages render, then a success toast with the filename.
- "Print" stays as a separate secondary button for users who want paper or a system PDF printer.
- Clear inline error with a retry action if rendering fails; multi-page documents keep page breaks (no row split across pages).

## Technical notes

- `src/components/document-preview.tsx`: single `stampGeometry` helper shared by the React overlay and `buildHTML`; export path switches from `window.open` + `print()` to `html2pdf.js` (already a dependency) with `jsPDF` A4 settings, `html2canvas` scale 2, and `pagebreak: { mode: ["css", "legacy"], avoid: "tr" }`.
- Print HTML wrapper changes from `@page { margin: 22mm }` to a zero-margin page with an inner 22mm-padded container, so percent coordinates resolve against the full page in both renderers.
- New `logStampChange` calls in `document-preview.tsx` (`commitPlace`, signer select, show-stamp toggle) and in `src/lib/stamp-refresh.ts`, using `logActivity` with new actions `stamp_changed` / `signer_changed`.
- New migration: `public.branding_audit` (company_id, subject_type `company` | `user`, subject_id, field, old_value, new_value, actor_id, created_at) with GRANTs for `authenticated` + `service_role`, RLS select for users with company access, insert restricted to the acting user within their companies. Wired from `src/routes/_authenticated/companies.tsx` (stamp upload) and `src/routes/_authenticated/settings.tsx` (signature upload).
