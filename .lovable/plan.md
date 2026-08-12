# Interaction & Motion Polish Pass

Goal: make Axel feel fluid and satisfying — micro-animations, refined hover states, responsive feedback on every click — without changing any business logic, data, or layout structure.

## 1. Motion foundation (src/styles.css)

- Add a small set of motion tokens: durations (fast 120ms, base 200ms, slow 320ms) and easings (standard, spring-ish `cubic-bezier(0.22,1,0.36,1)`, snappy out).
- Replace the current blanket 300ms transition on all interactive elements with a tighter 160–200ms default; 300ms feels sluggish for clicks.
- Add reusable utilities: `hover-lift`, `press-scale` (active:scale-[0.97]), `focus-ring` (animated violet ring), `shimmer` (skeleton loading), `stagger-in` (list entrance), `underline-grow` for links.
- Keep the existing `prefers-reduced-motion` guard and extend it to the new utilities.

## 2. Core UI primitives (src/components/ui)

- **Button**: press scale + subtle shadow change, spinner slot for pending state, ripple-free but with an accent glow on primary hover.
- **Card**: optional interactive variant with lift + border tint on hover.
- **Input / Textarea / Select**: animated focus ring and border color, gentle label/placeholder settle.
- **Checkbox / Switch / Radio**: spring-y check-mark draw and thumb travel.
- **Tabs**: sliding active indicator instead of instant swap.
- **Dialog / Sheet / Popover / Dropdown**: consistent scale+fade enter/exit with correct transform origin.
- **Table**: row hover tint, sticky header shadow when scrolled, cell focus ring.
- **Tooltip**: fast fade+lift, short delay so it feels responsive not twitchy.
- **Badge / Toast (sonner)**: entrance pop, status-color pulse for success/destructive.

## 3. App-level polish

- **Sidebar (app-shell)**: animated collapse/expand of groups, active item with a sliding accent bar, icon micro-nudge on hover, smooth width transition.
- **Page transitions**: subtle fade+rise on route content mount.
- **KPI cards**: count-up number animation on mount and on value change, hover lift.
- **Lists/tables**: staggered fade-in of rows on first render.
- **Empty & loading states**: shimmer skeletons instead of blank areas.
- **Buttons that trigger async work** (save, send, export, reconcile): inline pending spinner + success check flash.

## 4. Constraints

- No changes to data fetching, permissions, calculations, or document/PDF output.
- All animation values come from CSS tokens — no hardcoded colors.
- Everything must respect `prefers-reduced-motion`.
- Performance: transform/opacity only, no layout-thrashing animations.

## Technical notes

- Motion is CSS-first (Tailwind v4 utilities + tokens in `src/styles.css`); `tw-animate-css` is already available for enter/exit keyframes. A tiny `useCountUp` hook handles KPI numbers. No new animation library unless a shared-layout effect requires it.
