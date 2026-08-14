# Typography Swap — ClickUp Font Pairing

Swap the app's fonts to ClickUp's pairing. Font swap only — no size, color, or layout changes.

## Fonts
- **Headings & display** (`--font-display`): `'Plus Jakarta Sans'`, weights 500/600/700/800
- **Body & UI** (`--font-sans`): `'Inter'`, weights 400/500/600
- Mono (`--font-mono`): drop the now-unused Roboto Mono reference, fall back to `ui-monospace, monospace`

## Changes

### 1. `src/routes/__root.tsx` — head links
Replace the current Roboto/Material-Symbols stylesheet link with a single Google Fonts link that imports **Plus Jakarta Sans** (500,600,700,800) and **Inter** (400,500,600), and keep the Material Symbols Outlined import (icons stay).

New links block:
```text
preconnect  https://fonts.googleapis.com
preconnect  https://fonts.gstatic.com  (crossOrigin: "anonymous")
stylesheet  https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=swap
```

### 2. `src/styles.css` — `@theme inline` font tokens
Update lines 10–12:
```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif;
--font-display: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: ui-monospace, "Roboto Mono", monospace;
```

### 3. `src/styles.css` — heading weights & spacing (lines 246–250)
- `h1, h2, h3, h4, .font-display` → keep `font-family: var(--font-display)`.
- Default heading `font-weight` → `600` (Plus Jakarta base for headings; 700/800 applied per-component as already is).
- Large headings: `letter-spacing: -0.01em`; body `line-height: 1.5` (already 1.5 — no change).

No other size/color/layout rules touched.
