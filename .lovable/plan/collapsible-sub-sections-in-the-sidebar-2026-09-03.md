# Collapsible sub-sections in the sidebar

Today only the module bars (Finance, People, Admin…) collapse; the sections
inside them are static labels. Make each section collapsible too.

## What changes

- Each section label inside an open module becomes a clickable row with its own
  chevron, toggling just that section's page links.
- Open/closed state is remembered per section across reloads, same as modules.
- The section containing the current page always opens automatically, so you
  never lose your place after navigating.
- Modules with only one section keep their current look (no redundant second
  header) — their links show directly under the module bar.
- Keyboard and screen-reader accessible: the section header is a real button
  with expanded state, focus ring, and the existing accordion animation.

## Technical notes

- `src/components/app-shell.tsx`, `SidebarModuleGroup`: wrap each multi-section
  block in a `Collapsible`, reusing the module pattern (local state seeded from
  active route, persisted in a new `axel.navSectionOpen.v1` localStorage key
  under `module:section` keys).
- The leading rule + small-caps label styling stays; a small chevron is added at
  the row end, rotating like the module chevron.
- Rail flyouts, mobile nav behaviour, role filtering and routes are unchanged.
