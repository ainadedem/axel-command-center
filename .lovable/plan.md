# Restyle Axel to the "Zentra" reference look

A full visual refresh of the whole app to match the uploaded dashboard reference: soft light canvas, floating white rounded cards, thin geometric type, subtle gradients, and a light multi-hue chart family. Violet is retired as the brand color (per your answer) in favor of the reference blue.

## Direction

- Canvas: warm-neutral light gray (#F2F2F4-ish), app content floating on it as white cards with generous radius and very soft shadows — no heavy borders.
- Primary: reference blue. Charts get the reference multi-hue family (blue, pink, green, amber) used sparingly.
- Type: geometric grotesque, thin/light weights for big numbers, small uppercase-ish labels in muted gray. Numbers keep tabular figures.
- Gradients: soft, low-saturation — the "insight" panel style (peach → blue → violet mesh) reserved for one highlight card per page, plus subtle diagonal hatch/gradient fills in area charts.
- Density: airier padding, lighter dividers, smaller muted secondary text.

## What changes

1. Theme tokens (`src/styles.css`)
   - New background/surface/border/muted scale, blue primary + glow, new chart-1..5 palette, softer shadows, larger radius, refreshed gradient tokens (surface, primary, mesh/insight, chart fills).
   - Dark mode values realigned so the app stays coherent.
   - Font swap: geometric sans for UI + display (loaded via `<link>` in `src/routes/__root.tsx`), mono kept for figures.

2. Shell (`src/components/app-shell.tsx`)
   - Sidebar and topbar on the light canvas, card-style content region, pill nav items with soft active fill, rounded search field, lighter footer. Keeps the existing motion pass.

3. Shared components
   - `card`, `button`, `input`, `table`, `tabs`, `badge`, `select`/`dialog` skins: flatter borders, softer shadows, pill buttons and segmented tabs like the reference.
   - `kpi-card`: large thin figure, small trend pill, optional inline sparkline slot, and a gradient "insight" variant.
   - `page-header`, `data-toolbar`, `crud-toolbar`: date-range and filter chips styled as the reference's pill controls.

4. Charts (`src/routes/_authenticated/index.tsx`, `reports.tsx`)
   - Recharts restyled to the reference: hatch/gradient area fills, thin stroked lines, dotted-grid "dot matrix" accents where a bar chart is overkill, rounded thin bars, minimal axes, floating tooltip cards, progress bars for breakdown lists.

5. Sweep across all pages
   - Replace remaining violet-specific utility usage with the new tokens so every route (invoices, quotations, payroll, accounting, settings, etc.) inherits the new look; check document/PDF preview keeps its print-safe styling.

## Technical notes

- All colors stay semantic tokens in `src/styles.css` (`@theme inline` + `:root`); no hardcoded hex in components.
- Fonts via `<link>` in the root route head — never `@import` a URL in `styles.css`.
- Document/invoice PDF templates keep their own fixed print palette; only the app chrome changes.
- No backend, data, or permission logic is touched.
