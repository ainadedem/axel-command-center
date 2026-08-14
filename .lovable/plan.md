# ClickUp-style visual overhaul

Purely visual/interaction. No route, data, permission, or business-logic changes.

## Why this is mostly a token change

The app already uses semantic tokens everywhere (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`…) defined in `src/styles.css` — components don't hardcode colors. Swapping the token values restyles every page at once; the rest is targeted polish on shell, buttons, inputs, cards and motion.

## 1. Color system

Rewrite the token values in `src/styles.css` to the ClickUp palette:

- primary `#7B68EE`, primary hover `#6C5CE7`, ring/glow `rgba(123,104,238,0.15)`
- canvas `#FAFBFC`, cards/popovers `#FFFFFF`, sidebar `#F7F8FA`
- text `#292D34`, muted `#656F7D`, border/input `#E8EAED`
- success `#2ECC71`, warning `#FFC107`, danger `#E74C3C`
- accent gradient `linear-gradient(135deg,#7B68EE,#C83CB9)` as a token, used sparingly (login hero, KPI highlight panel, key badges)
- sidebar active = purple tint at 12%, hover at 8%, icon + label turn purple
- chart series recolored to a purple-led ClickUp-ish family so graphs match

Dark mode stays supported (Settings has a theme switch) and gets a matching dark retune of the same palette rather than being removed.

## 2. Typography

Load Plus Jakarta Sans (600/700) and Inter (400/500) via the `<link>` tags in `src/routes/__root.tsx`, replacing the current Inter Tight link. Map `--font-display` to Plus Jakarta Sans and `--font-sans` to Inter; body line-height 1.5, tighter heading tracking.

## 3. Shape & spacing

- radius tokens: 8px cards/inputs, 6px buttons, 999px chips/avatars/pills (today everything is an 18px superellipse)
- shadow tokens replaced with a single soft `0 1px 3px rgba(0,0,0,0.08)`; cards use border OR shadow, not both
- outer app frame loses the heavy 28px rounded shell in favour of a flat canvas with floating white cards

## 4. Motion & interaction

Global 150ms ease-in-out on color/background/border/transform/shadow, plus:

- buttons: darken to hover token, `translateY(-1px)`, shadow `0 4px 12px rgba(123,104,238,0.25)`
- cards and table rows: hover background `#F7F8FA`, border darkens slightly, pointer cursor
- sidebar items: 8% purple fill, purple icon+text on hover; 12% fill when active
- inputs/selects/textareas: focus ring 2px purple + `0 0 0 3px rgba(123,104,238,0.15)`, no browser outline
- dialogs, dropdowns, popovers, tooltips: fade + scale 0.97→1 over 120ms
- switches, checkboxes, tabs: animated slide/fill with a springy ease
- all hover treatments mirrored on `:focus-visible` for keyboard users; reduced-motion support kept

## 5. Layout / chrome

- sidebar: `#F7F8FA` surface, purple active pill, collapsible behaviour kept as-is (mobile drawer kept)
- top bar: pill search with purple focus, breadcrumb-style context line, pill user avatar chip
- content: `#FAFBFC` canvas, white cards with 8px radius floating on it
- page headers, KPI cards, toolbars and empty states re-spaced on the 4px scale

## Accessibility

Purple `#7B68EE` on white is below AA for small body text, so it is used for fills, icons, active states and large text; link/small-text purple is darkened to the hover token where it sits on white. Muted `#656F7D` on `#FAFBFC` passes AA. Focus rings stay visible everywhere.

## Files touched

- `src/styles.css` — full token, radius, shadow and motion-utility rewrite (the bulk of the work)
- `src/routes/__root.tsx` — font links
- `src/components/app-shell.tsx` — sidebar/topbar/frame restyle
- `src/components/ui/*` (button, input, select, dialog, dropdown-menu, tabs, switch, checkbox, badge, card, table) — radius, hover, focus, animation variants
- `src/components/page-header.tsx`, `kpi-card.tsx`, `data-toolbar.tsx`, `charts.tsx` — spacing, gradient accents, chart palette
- Spot passes over route pages only where a page hardcodes a legacy look

## Verification

Build + screenshots of dashboard, invoices, settings and login at desktop and mobile widths, in light and dark, before reporting done.
