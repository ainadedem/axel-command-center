# Profile pictures + document ownership

## Where things stand today

- **Profile picture**: the account profile already has a picture field in the database, but there is no place in the app to set one. Nothing in Settings or the top bar shows or uploads a personal photo. Clients, suppliers and team members already have working picture upload.
- **Who made it**: quotations already record their creator and the Quotations table has an Owner column. Invoices, purchase orders and expenses record nothing — there is no way to tell who created them.

## What to build

### 1. Personal profile picture
- Add an "Account" picture control in Settings, next to name/email, using the same click-to-upload avatar used elsewhere (max 5 MB, images only, stored in the private avatars bucket).
- Allow editing the display name in the same block, saved together with the picture.
- Show the picture in the app top bar / account menu, falling back to initials.
- Show member pictures in the Users & Access list.

### 2. Who created a document
- Record the creating user on invoices, purchase orders and expenses (same as quotations do now).
- Add a sortable "Owner" column to the Invoices and Purchase orders tables, showing the person's name (falling back to email, "—" for older records).
- Owner is app-only: printed invoices, quotations and PDFs stay unchanged.
- Existing records keep no owner; no back-filling.

## Technical notes

- Migration: add `created_by uuid default auth.uid()` to `invoices`, `purchase_orders`, `expenses`. No policy change (access stays company-scoped). Profiles read policy for colleague names already exists and is reused.
- `src/routes/_authenticated/settings.tsx`: add `AvatarUpload` (folder `profiles`) + display name field writing to `profiles`, then `refresh()` from the auth context.
- `src/components/app-shell.tsx`: render `Avatar` from `profile.avatar_url` in the account button.
- Extract the owner-name resolution currently inline in `quotations.tsx` into a small shared hook (e.g. `src/hooks/use-owner-names.ts`) and reuse it on invoices and purchase orders.
- `src/lib/mock-data.ts` + `src/lib/db-sync.ts`: add `createdBy` to the Invoice, PurchaseOrder and Expense types and their row mappings, stamped on create like quotes.
- `src/components/document-preview.tsx`: unchanged.

## Out of scope
- Filtering documents by owner or restricting visibility by creator.
- Changing PDF/printed layouts.
