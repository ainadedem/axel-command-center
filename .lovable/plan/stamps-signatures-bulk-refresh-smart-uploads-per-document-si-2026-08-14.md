# Stamps & signatures: bulk refresh, smart uploads, per-document signer, drag placement

## 1. Per-document signer and stamp placement (data)

Today the stamp is a company-level setting (position, width, opacity) and the signature always comes from the document's last editor, resolved live. Nothing is stored per document, so placement cannot vary and the signer cannot be chosen.

Migration adds to `invoices`, `quotes` and `purchase_orders`:
- `signer_id` (uuid) — who signs this document
- `stamp_x`, `stamp_y` (numeric, percent of the page) and `stamp_scale` — saved coordinates from the drag control
- `stamp_dirty` (boolean) — set when the company stamp or a signature changes, so a document can be flagged as needing a refresh

Existing RLS on those tables already scopes writes; new columns inherit it.

## 2. Signer selection in the preview

- The preview toolbar gets a **Signer** picker listing users with access to the document's company (reusing the existing company-users hook).
- Default: the current user when they edit the document; otherwise the stored `signer_id`, falling back to last editor / creator as today.
- On save of an invoice or quotation, `signer_id` is set to the current user unless it was explicitly chosen — matching "updates automatically when I edit the document".
- Signature image is still resolved from that user's profile, so revoking or replacing a signature propagates.

## 3. Drag-and-drop stamp positioning

- In the PDF preview the stamp becomes a draggable overlay on the A4 sheet instead of a fixed corner block.
- Dragging updates x/y as a percentage of the sheet, with a resize handle for scale; values snap lightly to page margins.
- Save writes the coordinates to the document; a **Reset to company default** action restores the corner position from company settings.
- Print/export uses the same absolute coordinates so what you drag is what exports.

## 4. Upload validation and automatic processing

Stamps (company profile) and signatures (settings) get the same treatment avatars already have, tuned for marks on paper:
- Validation: type, file size, and minimum pixel dimensions, with a clear inline error.
- Automatic processing before upload: trim empty margins, resize to a max edge (about 1000 px), and compress.
- Transparency is preserved: PNG/WebP with alpha stay alpha (no white background flattening); opaque JPEGs get an optional white-to-transparent pass for scanned stamps and signatures.
- Result is uploaded to the private buckets exactly as now.

## 5. Bulk refresh action

- Invoices and Quotations lists get a **Refresh stamp & signature** action in the existing bulk action bar (appears when rows are selected).
- For every selected document it re-resolves the signer, re-applies the current company stamp settings when the document has no custom coordinates, clears `stamp_dirty`, and records one activity entry per document.
- Quotations that already have a stored PDF are marked as "PDF outdated" in the list so you know which ones to re-send; the action itself does not silently email anyone.
- The whole batch is one undo entry, consistent with the existing bulk edit.
- Changing a company stamp or a personal signature sets `stamp_dirty` on affected documents, and the lists show a small "needs refresh" badge so the bulk action is discoverable.

## Technical notes

- New: `src/lib/stamp-refresh.ts` (bulk logic, mirrors `src/lib/bulk-edit.ts`), `src/components/stamp-placer.tsx` (drag overlay), `src/components/signer-picker.tsx`.
- Extended: `src/lib/image-resize.ts` (trim, alpha-preserving encode, white-key removal), `src/components/avatar-upload.tsx` (accepts a processing profile), `src/components/document-preview.tsx` (signer picker, absolute stamp placement in `signBlockHtml` and the print path), `src/lib/db-sync.ts` and `src/lib/mock-data.ts` (new fields), `companies.tsx`, `settings.tsx`, `invoices.tsx`, `quotations.tsx`.
- One migration for the new columns; no changes to existing columns or policies.
