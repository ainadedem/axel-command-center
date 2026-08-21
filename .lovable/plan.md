# Add Back button + Breadcrumbs to the global topbar

## Goal
Give users a consistent way to orient themselves and retrace steps: a **back button** (router history) and a **breadcrumb trail** in the global topbar, visible on every page.

## Where it goes
`src/components/app-shell.tsx` → `Topbar` component (the `<header>` at ~line 654).

Layout order inside the header, left-to-right:
1. Hamburger menu (mobile only, existing)
2. Mobile brace mark (existing)
3. **NEW: Back button** — a `ChevronLeft` icon button (same 9×9 round style as undo/redo), calls `router.history.back()`, disabled when there is no previous entry (`router.history.canGoBack()`). Tooltip: "Back".
4. **NEW: Breadcrumb trail** — compact, `<nav aria-label="Breadcrumb">` with `<Link>` segments, truncated. Sits between the back button and the search form. On narrow screens collapses to just the current-page label.
5. Search form (existing)
6. Undo/redo, refresh, write trail, fx, new, bell, account (existing)

## Breadcrumb mapping
Reuse the existing `sections` array (already imported in-app) to map `pathname` → label. Build a helper `useBreadcrumbs(pathname)`:

- The root segment is always "Home" → `/`.
- For each nav item whose `to` matches the current path (exact, or prefix for nested), emit `{ label, to }`.
- For dynamic detail routes (e.g. `/invoices`, `/clients`), the list route is the breadcrumb; detail sub-pages (if any use a `$param`) fall back to showing the parent list label + "Detail".
- Unknown paths fall back to a title-cased last segment.

Keep it simple: a flat 2-3 segment max (Home / Section / Page). No DB lookups.

## Back button behavior
- Use `useRouter()` → `router.history.back()`.
- `disabled` when `!router.history.canGoBack()`.
- Same visual treatment as undo/redo: `h-9 w-9`, rounded-full, hover surface, `active:scale-95`, 200ms transition.
- Hidden on mobile (`hidden sm:grid`) to preserve space — the mobile hamburger already covers navigation; breadcrumbs still render.

## Breadcrumb styling
- Container: `hidden md:flex items-center gap-1 text-sm text-muted-foreground min-w-0`.
- Each segment: `<Link>` with `truncate`, last segment bold + foreground, non-interactive.
- Separators: `ChevronRight` `h-3.5 w-3.5 text-foreground/30`.
- Active-segment highlight via `aria-current="page"`.
- Cap width with `max-w-[28ch]` per segment so the trail never pushes the search bar off-screen.

## Accessibility
- `<nav aria-label="Breadcrumb">`.
- Back button `aria-label="Go back"`, `title="Back"`.
- Breadcrumb `aria-label` on the `<nav>`; current page link gets `aria-current="page"`.

## Non-goals
- No per-page custom breadcrumb overrides (one global mapper covers all routes).
- No mobile back button (hamburger already serves mobile navigation).
- No changes to sidebar, route files, or any backend.

## Files changed
- `src/components/app-shell.tsx` — add back button + breadcrumb nav to `Topbar`; add a small `useBreadcrumbs` helper + import `ChevronLeft`, `ChevronRight`, `useRouter`.
