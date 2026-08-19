# Invoice toolbar: columns, presets, and editable status

## Current state (verified)

- The unified invoice toolbar already contains a **Columns** menu (`ColumnPicker`) with per-column checkboxes plus reset visibility / widths / order.
- It already contains a **preset bar** (`FilterPresetBar`) that saves the current status + PO chip selection per user and per route, applies it on click, and deletes it — but there are **no starter presets** and **no rename**.
- The invoice preview shows status only as a printed pill; it cannot be changed there.

So item 1 exists; the work is item 2's gaps, item 3, and small polish on the columns menu.

## 1. Columns menu polish

Keep the existing menu, add:
- A quick **Show all / Hide optional** pair at the top so a workflow switch is one click.
- A small hidden-count already shows on the trigger — keep it.
- Widen the menu slightly and group locked (always-on) columns visually so it is clear why they can't be unchecked.

## 2. Starter presets + rename

- Seed four built-in presets the first time the invoices page loads for a user: **Draft**, **Sent**, **Overdue**, **PO missing**. They behave exactly like saved presets (click to apply, click again on the active one to clear) and can be renamed or deleted like any other.
- Add **rename**: a pencil action on each preset chip (or right-side menu) that opens the same small popover used for saving, pre-filled with the current name.
- Add **update from current filters** on the active preset, so a tweaked selection can be written back without re-creating the preset.
- Presets keep the current per-user, per-route localStorage storage.

## 3. Editable status in the invoice preview

- Add a **Status** dropdown to the preview's control strip (next to the existing "Show status" checkbox), listing the invoice statuses: draft, sent, partial, paid, overdue, cancelled.
- Changing it writes immediately through the existing `onDocChange` path (`invoicesStore.update`) so the change is optimistic, appears in the printed pill instantly, and is recorded in the document activity trail like other preview edits.
- Guard rails: selecting **paid** sets the paid date to today if empty; selecting **cancelled** asks for confirmation because it stamps a cancellation. Money fields (amount/paid) are not edited here.
- The dropdown is hidden for read-only viewers (same permission check the preview already uses for other edits).

## Technical notes

- `src/components/list-table.tsx` — extend `ColumnPicker` with show-all / hide-optional actions.
- `src/lib/filter-presets.ts` — add `rename(id, name)`, `update(id, statuses, po)`, and one-time seeding of the four defaults; `src/components/filter-presets.tsx` — rename popover and update action.
- `src/components/document-preview.tsx` — add a status `Select` in the controls area; extend the `onDocChange` patch type with `status` and `paidDate`.
- `src/components/invoice-preview.tsx` — already forwards patches to `invoicesStore.update`; pass the allowed status list so quotes/POs are unaffected.
- No database or RLS changes; status writes use the existing invoice update path.

## Verify

- Typecheck clean; invoices page: columns toggle and persist, presets seed/apply/rename/delete, preview status change persists after reopening the invoice and shows in the table row chip.
