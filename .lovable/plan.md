# Consistent typography across pages, tables and forms

Today the app mixes three different sizing systems: Tailwind steps (`text-xs`, `text-sm`, `text-base`), ~600 hand-written pixel sizes (`text-[9px]`, `text-[10px]`, `text-[11px]`) scattered over 40+ files, and separate table tokens. Fields, labels and helper text end up different sizes from one page to the next. The fix is one type scale that every page, table and form uses.

## The type scale

Six roles, defined once as CSS tokens and exposed as utility classes:

| Role | Size | Used for |
| --- | --- | --- |
| Display | 24-30px fluid | Page hero numbers, big KPIs |
| Title | 18px | Page titles, dialog titles |
| Subtitle | 15px | Section headings, card headers |
| Body | 13px | Default reading text, inputs, buttons |
| Label | 12px | Form labels, table headers, secondary text |
| Micro | 11px | Badges, chips, timestamps, captions |

Nothing smaller than 11px stays in the UI (the current 9px and 10px text is below comfortable reading size). The two density modes (compact / comfortable) shift Body and Label by 1px only, as they already do for tables.

## Forms

- All labels: Label role, same weight and colour everywhere.
- All inputs, selects, textareas and comboboxes: Body size, one shared height per density (currently inputs are 40px with `text-base` on mobile and `text-sm` on desktop, while many pages force `h-8`; this becomes one rule).
- Helper text, hints and validation messages: Label size.
- Dialog titles: Title; dialog descriptions: Label.

## Tables

- Keep the existing table tokens but re-point them at the scale: header = Label, cells = Body, badges inside cells = Micro.
- Column headers get one consistent weight and letter-spacing rather than the per-page variants in use now.

## Pages

- Page header title = Title, subtitle = Label, KPI value = Display, KPI caption = Label.
- Toolbars, filter chips, empty states and detail panels move onto the same roles.

## Out of scope

Document preview and printed/exported PDF layouts keep their own typography, since they must match the paper output.

## Technical notes

- Add `--text-display/title/subtitle/body/label/micro` (size + line-height) to `src/styles.css`, plus `@utility` classes `t-display`, `t-title`, `t-subtitle`, `t-body`, `t-label`, `t-micro`. Density variants adjust the body/label tokens under the existing compact/comfortable selectors.
- Update the shadcn primitives once (`input.tsx`, `textarea.tsx`, `select.tsx`, `label.tsx`, `button.tsx`, `dialog.tsx`, `table.tsx`) so most screens inherit the fix without page edits.
- Re-point `--tbl-font` / `--tbl-head-h` at the new tokens in `src/styles.css`.
- Sweep the arbitrary sizes: replace `text-[9px]`/`text-[10px]`/`text-[11px]` with `t-micro`, `text-xs` with `t-label` or `t-body` depending on role, `text-sm` with `t-body`, `text-base`/`text-lg` with `t-subtitle`/`t-title`. Files with the highest counts first: `invoices.tsx`, `quotations.tsx`, `pipeline.tsx`, `clients.tsx`, `dashboard.tsx`, `app-shell.tsx`, `data-toolbar.tsx`, plus the shared shell and panel components.
- Exclude `src/components/document-preview.tsx` and the PDF render/export paths from the sweep.
- Verify with typecheck + build, then a Playwright pass over Quotations, Invoices, Clients, Projects, Journal and a form dialog to confirm no clipping or overlap at both densities.
