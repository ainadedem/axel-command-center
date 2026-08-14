# Invoice table: status icons, full amounts, resizable columns

## 1. Status badges with icons and color
Replace the plain text status pill with an icon + label badge, used everywhere invoice status is shown (table, detail dialogs, compliance cards):

- Draft — file/pencil icon, neutral grey
- Sent — send icon, blue (primary)
- Partial — half-circle/pie icon, amber (warning)
- Paid — check-circle icon, green (success)
- Overdue — alert-triangle icon, red (destructive)
- Cancelled — x-circle icon, muted with strikethrough

The "PO missing" marker becomes its own icon chip (file-warning, amber); when a PO is attached or waived it shows a subtle file-check chip in the same slot, so the PO state is always readable at a glance. Colors come from existing semantic tokens (no hardcoded hex), badges keep accessible contrast and carry a title/aria-label with the full status wording.

## 2. Write the full amount
Amount and Balance columns show the complete number (e.g. 12 450 000 MGA) instead of the compact 12.4M form. The compact/full toggle stays available, but full is the default for these tables, and tabular figures keep the columns aligned.

## 3. Resizable columns
Every column header in the invoice table gets a drag handle so widths can be adjusted, with widths persisted per user in local storage and a "Reset widths" entry in the existing column menu. Minimum width prevents columns collapsing to nothing.

## Technical notes
- New shared `StatusBadge` (icon map + tone map, lucide icons) placed in `src/components/status-badge.tsx`, replacing the local `statusStyles` map in `src/routes/_authenticated/invoices.tsx`.
- Amount rendering: pass an explicit full-format option to `fmtAmount` for the Amount/Balance cells rather than relying on the global `NumberFormatMode`.
- Reuse the existing `useResizableColumns` / `ResizeHandle` from `src/components/resizable-columns.tsx`; switch invoice `ListTh` percentage widths to pixel widths driven by that hook and add the handle to each header cell. Table gets `table-layout: fixed` with a horizontal scroll container so resizing behaves.
- Mobile stacked view is unchanged; resizing applies to the desktop table only.

Scope: the Invoices page. The same `StatusBadge` is built to be reusable so Quotations and Purchase Orders can adopt it next.
