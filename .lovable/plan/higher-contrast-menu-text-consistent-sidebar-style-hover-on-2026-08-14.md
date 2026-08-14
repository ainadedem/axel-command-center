# Higher-contrast menu text + consistent sidebar-style hover on all buttons

## Goal
1. Replace the light-grey sidebar/menu text with higher-contrast text so inactive nav items and icons read clearly against the sidebar surface.
2. Give every button the same hover treatment the sidebar uses: a soft `--surface-container` background fill, text shifting to `--foreground`, over the existing 150ms `cubic-bezier(0.2,0,0,1)` transition (plus the existing `active:scale-[0.98]` press).

## Changes

### 1. Menu text contrast — `src/components/app-shell.tsx`
Scope the change to navigation only (do not touch global tokens, since `--muted-foreground`/`--sidebar-foreground` are used app-wide).

- Inactive nav item `<Link>` (SidebarSection): `text-sidebar-foreground` → `text-foreground/80`.
- Inactive nav icon: `text-muted-foreground` → `text-foreground/55`.
- Section label (`SidebarSection` trigger): `text-muted-foreground/80` → `text-foreground/55`.
- Company switcher subtitle `text-muted-foreground` → `text-foreground/60`.
- "The Axiom Winford Group" subtitle: `text-foreground/70` → `text-foreground/80`.
- Footer Settings link: `text-sidebar-foreground` → `text-foreground/80`.

Keep active items on `--primary-container` / `--on-primary-container` unchanged.

### 2. Consistent button hover — `src/components/ui/button.tsx`
Align non-filled variants to the sidebar hover so every button behaves the same:

- `ghost`: `hover:bg-[var(--surface-container)] hover:text-foreground` (already close — keep).
- `outline`: `hover:bg-[var(--surface-container)] hover:text-foreground` (already close — keep).
- `secondary`: `hover:bg-[var(--surface-container-high)] hover:text-foreground` (add `hover:text-foreground`).
- `tonal`: add `hover:bg-[color-mix(in_oklab,var(--primary-container)_85%,var(--surface)))]` so it visibly fills like the sidebar instead of only brightening; keep `--on-primary-container` text.
- `elevated`: keep elevation but add `hover:bg-[var(--surface-container)]` so the fill responds.
- `link`: keep underline hover (text link semantics differ).
- `default` / `destructive` (filled brand buttons): keep their existing `hover:bg-[var(--primary-hover)]` / `hover:brightness-110` + `hover:shadow-[var(--shadow-soft)]` — they are filled, so a grey fill would look wrong.

The base class already has `transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)]` and `active:scale-[0.98]`, matching the sidebar exactly. No timing change needed.

### 3. Hover fill for raw buttons — `src/styles.css`
Many buttons across pages are raw `<button>` elements (icon buttons, toolbar actions) that currently have no hover fill. Add a scoped global rule in `@layer base` so plain interactive elements gain the sidebar-style fill, without clobbering filled/branded buttons:

```css
button:where(:not([class*="bg-primary"], [class*="bg-destructive"], [class*="bg-[var(--primary-container"])),
[role="button"]:where(:not([class*="bg-primary"], [class*="bg-destructive"], [class*="bg-[var(--primary-container"])) {
  &:hover { background-color: var(--surface-container); }
}
```

The existing global transition rule (lines 271–280) already covers timing, so only the fill is added. Filled primary/destructive/tonal buttons are excluded via the `:not()` selectors.

## Verification
- Open the app, hover inactive nav items: text + icon visibly darken to near-foreground, pill fills with `--surface-container`.
- Hover any toolbar/icon button on Invoices/Quotations: same soft fill appears.
- Press any button: `active:scale-[0.98]` press snap (already present) — confirm it still fires.
- Confirm filled primary "New" button still darkens to `--primary-hover`, not grey.
