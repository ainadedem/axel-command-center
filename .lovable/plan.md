# Replace the Axel logo with the uploaded `{axel}` wordmark

## What you uploaded
Two SVG versions of the same `{axel}` wordmark (526 x 167, wide horizontal lockup):
- `Layer_1.svg` — black fill (for light backgrounds)
- `Group_59491.svg` — white fill (for dark backgrounds)

## Current state (confirmed by reading the code)
- `src/routes/login.tsx` line 4 imports `@/assets/axel-logo.png` — the big logo on the sign-in screen.
- `src/components/app-shell.tsx` line 20 imports `@/assets/axel-icon-purple.png` — the small square mark in the sidebar/header.
- `public/favicon.png` is the browser-tab icon, referenced from `src/routes/__root.tsx` line 77.
- `src/routes/__root.tsx` lines 70-71 set the social share thumbnail (`og:image` / `twitter:image`) to an auto-generated Lovable screenshot.

## Plan

1. **Add the wordmark as a theme-aware component**
   Create `src/components/axel-wordmark.tsx` that renders the SVG paths inline with `fill="currentColor"`. Inlining as a React component (rather than an image file) means the one mark automatically renders black on light mode and white on dark mode, matching your two uploads without needing to swap files. It also stays crisp at any size.

2. **Sign-in screen** — replace the `axel-logo.png` image in `src/routes/login.tsx` with the wordmark component, sized appropriately for the login card.

3. **Sidebar / header** — replace `axel-icon-purple.png` in `src/components/app-shell.tsx` with the wordmark. Because the new mark is a wide horizontal lockup rather than a square icon, it will show full-width when the sidebar is expanded. When the sidebar is collapsed, fall back to a compact `{ }` brace glyph derived from the same mark so it still fits the narrow rail.

4. **Favicon** — render the wordmark's brace element to a square 64x64 PNG and write it to `public/favicon.png` (a wide wordmark squeezed into 32px is unreadable, so the brace mark is used for the tab icon). The existing `<link rel="icon">` in `__root.tsx` already points there, so no tag change needed.

5. **Social share thumbnail** — generate a 1200x630 share card featuring the new wordmark on the Axel background, upload it to the CDN, and point `og:image` / `twitter:image` in `src/routes/__root.tsx` at it, replacing the current auto-screenshot.

6. **Clean up** — remove the now-unused `src/assets/axel-logo.png`, `axel-icon-purple.png`, and `axel-icon-dark.png` once nothing references them.

## Notes
- The company logos users upload per-company (used on invoices and quotations) are separate and untouched by this — this only changes the Axel product branding.
- Link previews on WhatsApp/LinkedIn cache aggressively, so the new share thumbnail may take a while to appear on already-shared links.

## Files touched
- New: `src/components/axel-wordmark.tsx`
- Edited: `src/routes/login.tsx`, `src/components/app-shell.tsx`, `src/routes/__root.tsx`
- Replaced: `public/favicon.png`
- Deleted: `src/assets/axel-logo.png`, `src/assets/axel-icon-purple.png`, `src/assets/axel-icon-dark.png`
