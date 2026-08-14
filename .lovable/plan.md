# Change the browser/social thumbnail

## Current state (confirmed by reading the code)
- The Open Graph / social thumbnail is defined in `src/routes/__root.tsx`, lines 70–71, as `og:image` and `twitter:image`.
- Both currently point to an auto-generated Lovable preview screenshot on the R2 CDN:
  `https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/.../...png`
- The favicon is a separate file: `public/favicon.png` (referenced at line 77 via `{ rel: "icon", href: "/favicon.png" }`).
- The app uses a system-blue + Inter Tight identity (set during the recent "Zentra"/Apple HIG redesign).

## What "thumbnail" means here
The image that appears when the app URL is shared on WhatsApp, LinkedIn, Slack, iMessage, etc. (Open Graph / Twitter card). Not the favicon (small browser-tab icon).

## Plan

1. **Generate a branded 1200×630 social thumbnail** matching the Axel identity:
   - System-blue gradient background, "AXEL" wordmark + tagline "Premium multi-company, multi-currency finance command center".
   - Clean, Apple-grade layout. Saved as a PNG via `imagegen--generate_image` (premium quality for legible text).
2. **Externalize the image** with `lovable-assets create` so it gets a stable, immutable CDN URL (`.asset.json` pointer). This is the correct way to host a binary image in this project.
3. **Update `src/routes/__root.tsx`** (lines 70–71) to set `og:image` and `twitter:image` to the new asset URL. Keep `og:type: website`, `twitter:card: summary_large_image`, and the existing `og:url`/`og:title`/`og:description`.
4. **Optional: refresh the favicon** (`public/favicon.png`) to match the new thumbnail if you want a consistent icon in the browser tab. (Ask first — out of scope unless you want it.)
5. **Verify** by running the build and confirming the meta tags resolve to the new URL.

## Notes
- The image must be served from an absolute `https://` URL (relative paths don't work for OG images). The `lovable-assets` CDN URL satisfies this.
- WhatsApp/LinkedIn cache OG images aggressively; changes can take a few minutes (or a cache-buster query param) to appear in link previews. This is expected and not a bug.
- If you'd rather supply your own image file instead of having one generated, say so and I'll upload that instead of generating one.

## Files touched
- `src/routes/__root.tsx` (meta tags only)
- New: `src/assets/og-thumbnail.png.asset.json` (asset pointer, committed)
- Transient: generated PNG at `/tmp/...`, uploaded then removed from the repo
