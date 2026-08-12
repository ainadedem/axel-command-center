# Profile photos, row-level ownership, and document history

## 1. Profile picture: crop, validation, resizing

The Settings account picture currently uploads the raw file. It becomes a proper editor:

- Click the picture to open a crop dialog (square frame, drag to reposition, zoom slider) — the same interaction already used for company logos.
- Validation before anything is uploaded: images only (JPEG, PNG, WebP, GIF), max 10 MB, minimum 64x64 px. Clear inline error when a file is rejected.
- The cropped result is resized to 512x512 and re-encoded as WebP (quality ~0.85) so avatars stay a few tens of kilobytes and load instantly everywhere.
- A second 96 px thumbnail is not needed — 512 px covers every place the avatar appears (top bar, Users & Access, Settings).

## 2. Ownership down to the line level

Documents already record who created them. Ownership now goes one level deeper:

- Every quotation, invoice, and purchase-order line records the user who added it and when.
- In the line editor, each row shows a small "added by" hint (name + date) on hover for lines created by someone else; own lines stay clean.
- Lines added while editing an existing document are stamped with the current user, so a quote edited by a colleague shows mixed ownership.
- Printed documents and PDFs are unchanged — ownership is app-only.
- Existing lines have no recorded author and show nothing.

## 3. Activity timeline per document

A new history panel on quotations, invoices, and purchase orders shows, newest first:

- Created
- Edited (with a short summary of what changed: amount, dates, client, status fields, lines added/removed)
- Status changes (sent, accepted, cancelled, paid…)
- Payments recorded (amount and currency)
- Document/PDF uploaded or replaced

Every entry has a timestamp and the user who did it, with their profile picture. The panel opens from the document preview dialog and from a "History" action in the row actions.

Events are recorded from the moment this ships; older documents show a single "No recorded activity yet" state.

## 4. Last updated by / last updated at

Quotations, invoices, and purchase orders record who last changed them and when.

- Shown in the document dialog header ("Updated by Rina · 2 hours ago").
- Available as sortable/groupable columns in each table (hidden by default, enabled via the column picker so existing tables don't get wider by surprise).

## Technical notes

Database migration:
- `invoice_lines`: add `created_by uuid`, `created_at` already exists.
- `quotes.lines` and `purchase_orders.lines` are JSONB — line ownership is stored inside each line object (`createdBy`, `createdAt`), no schema change.
- Add `updated_by uuid` to `quotes`, `invoices`, `purchase_orders`.
- New table `public.document_activity`: `id`, `company_id`, `doc_type` (quote | invoice | po), `doc_id`, `action`, `summary text`, `details jsonb`, `actor_id uuid`, `created_at`. GRANTs for `authenticated` (select/insert) and `service_role`; RLS scoped to companies the user can access via the existing company-access helper; no update/delete policies so history is append-only.

Frontend:
- `src/components/avatar-upload.tsx`: add optional `crop` mode opening a new `src/components/image-crop-dialog.tsx` (square variant extracted from the logo crop editor), plus shared validation/resize helper in `src/lib/image-resize.ts` (canvas → WebP blob → `uploadFile`).
- `src/lib/mock-data.ts`: `createdBy`/`createdAt` on `QuoteLine` and invoice lines; `updatedBy` on `Quote`, `Invoice`, `PurchaseOrder`.
- `src/lib/db-sync.ts`: map the new columns and JSONB line fields both ways; stamp `updated_by` on every update path.
- `src/lib/document-activity.ts`: `logActivity()` helper plus a `useDocumentActivity(docType, docId)` hook; a `diffDocument()` util produces the human-readable edit summary.
- `src/components/document-activity-panel.tsx`: timeline UI reusing `Avatar` and `useOwnerNames`.
- Wire logging into create/update/delete, payment, status-change and document-upload handlers in `quotations.tsx`, `invoices.tsx`, `purchase-orders.tsx`.
- Add Owner-style "Updated by"/"Updated" fields to each page's `FieldDef` list and table columns.

## Out of scope
- Back-filling history or line ownership for existing records.
- Ownership on expenses/transactions line level.
- Showing any of this on the printed documents.
