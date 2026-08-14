# White share thumbnail + working mobile layout

## 1. Social share thumbnail on white

The current share card (`src/assets/axel-og.png.asset.json`, referenced as `og:image` / `twitter:image` in `src/routes/__root.tsx`) uses a dark/branded background. Replace it with a clean 1200x630 card: pure white background, the black `{axel}` wordmark centred, a thin tagline line underneath, and a subtle blue rule as the only accent. Upload the new file to the CDN and repoint both meta tags at it.

Note: WhatsApp, LinkedIn and Slack cache previews aggressively — already-shared links will keep showing the old image until those platforms re-scrape.

## 2. Mobile is broken — what's actually wrong

Confirmed by reading `src/components/app-shell.tsx`:

- The sidebar is `hidden lg:flex` and there is **no mobile replacement**. Below 1024px the app has no navigation at all — no menu button, no company switcher, no way to change page except the browser URL.
- The topbar is a fixed-height single row (`h-14 px-6`) holding a full-width search field, the FX badge, a text "New …" button, bell and avatar. On a phone this overflows horizontally.
- Data tables (invoices, quotations, transactions, journal, grand-livre, balance, plan comptable, accounts, projects, reports, purchase orders, users & access) are plain wide `<table>` elements with no horizontal scroll container, so on narrow screens columns squash into unreadable stacked text — exactly what the screenshot shows.
- Several dialogs/forms use hard `grid-cols-2` / `grid-cols-3` / `grid-cols-4` with no mobile fallback, so inputs become too narrow to read.

## 3. Fixes

**Navigation shell**
- Add a mobile header row: hamburger button + compact `{axel}` brace mark + avatar.
- The hamburger opens the existing sidebar content in a slide-in drawer (Sheet) with an overlay; tapping a nav link closes it. Same sections, same role filtering, same company switcher — no duplicate nav definition.
- Topbar reflow: search collapses to an icon that expands into a full-width row on tap; the "New …" button becomes an icon-only round button under `sm`; the FX badge stays hidden on small screens (already is).
- Footer stacks and shrinks on mobile.

**Tables**
- Wrap every data table in a horizontal-scroll container with a sensible `min-width`, so columns keep their natural width and the user swipes sideways instead of reading squashed text. Add a soft fade on the right edge to signal more content.
- Keep the sticky header row working inside the scroller.
- On the highest-density pages (invoices, quotations, transactions, expenses) also allow the least important columns to hide below `md` so the default view is readable without scrolling: keep Number, Client, Amount, Status; hide Project, Company, Paid on, Timing, Owner behind the horizontal scroll.

**Forms, dialogs, cards**
- Dialogs get `max-w-[calc(100vw-2rem)]`, capped height and internal scroll on mobile.
- Fixed multi-column grids become `grid-cols-1 sm:grid-cols-2` / `sm:grid-cols-3` etc.
- KPI/stat rows go from 4-across to 2-across on mobile.
- Page headers use the grid + `min-w-0` + `truncate` pattern so long titles and action buttons coexist at 360px.

**Charts**
- Give chart frames a minimum height and let the responsive container shrink; rotate/thin x-axis labels on small widths so they stay legible.

## 4. Verification

Check the main pages (dashboard, invoices, quotations, transactions, clients, SOPs, settings) at 360px, 390px, 768px and 1280px, in both light and dark mode, and confirm: nav reachable, no horizontal page overflow, no clipped or overlapping text.

## Files touched

- `src/routes/__root.tsx` (og/twitter image), new `src/assets/axel-og-white.png.asset.json`
- `src/components/app-shell.tsx` (mobile drawer, topbar, footer)
- `src/components/page-header.tsx`, `src/components/data-toolbar.tsx`, `src/components/kpi-card.tsx`, `src/components/charts.tsx`, `src/components/ui/dialog.tsx`
- Table wrappers across the `src/routes/_authenticated/*` list pages
