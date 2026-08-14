# Company stamps & personal signatures on documents

Add two new visual marks to quotations and invoices:

1. A **company stamp** (uploaded in the company profile) placed on the document.
2. A **personal signature** (uploaded once by each user in Settings) that appears automatically as the signature of the person who created or last edited the document.

## What you'll be able to do

**In Companies → edit a company**
- Upload a stamp image (PNG with transparency recommended).
- Choose where it prints: bottom-right, bottom-left, or centered over the signature block.
- Adjust its size (width in px) and opacity, with a live preview next to the logo preview.
- Toggle "Show stamp on documents" on/off per company.

**In Settings → my profile**
- Upload a personal signature image (same uploader/cropper used for avatars).
- See a preview and remove/replace it.

**On quotations and invoices**
- A signature block prints at the bottom of the document: the signature image, the person's name, and the date.
- The name/signature used is the document's last editor (falls back to the creator if never edited).
- The company stamp renders in the chosen position, over/next to that block.
- Both appear in the on-screen preview and in the exported PDF.
- A per-document toggle in the preview toolbar lets you hide stamp and/or signature for a specific export.

## Access rules

- Only users who can edit a company can upload/change its stamp.
- A signature is private to its owner: only the owner can upload or change it, but the image is readable so it can render on documents that person signed.

## Technical notes

- Migration:
  - `companies`: add `stamp_url text`, `stamp_position text default 'bottom-right'`, `stamp_width int default 140`, `stamp_opacity numeric default 1`, `show_stamp boolean not null default false`.
  - `profiles`: add `signature_url text`.
  - No policy changes needed beyond confirming existing company/profile write policies cover the new columns (they are column-agnostic).
- Uploads reuse the existing storage helper used by `AvatarUpload` (private `avatars` bucket, `storage:` refs resolved by `useFileUrl`).
- `src/lib/mock-data.ts` `Company` type gains the stamp fields; `src/lib/company-context.tsx` maps the new columns both ways; `src/lib/db-sync.ts` writes them in the company upsert.
- `src/components/document-preview.tsx`: the HTML builder gains a `.signblock` + `.stamp` section after the notes/footer, driven by new props (`stampUrl`, `stampPosition`, `stampWidth`, `stampOpacity`, `signatureUrl`, `signerName`, `signedDate`). Since PDF export inlines images, stamp/signature refs are resolved to data/object URLs the same way the logo already is (`storage:` refs are skipped for export unless resolved first — this plan resolves them to data URLs so they survive export).
- Signer resolution: `doc.updated_by ?? doc.created_by` → profile lookup for `display_name` + `signature_url`, reusing the existing owner-name hook pattern in `src/hooks/use-owner-names.ts`.
- Preview toolbar toggles persist per document type in `localStorage`, matching the existing unit-column and density toggles.
