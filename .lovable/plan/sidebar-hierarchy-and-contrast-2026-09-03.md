# Sidebar hierarchy and contrast

The sidebar currently renders module headers, section labels and page links at
nearly the same weight and colour, so nothing reads as a level. Fix it by giving
each of the three levels a distinct visual treatment.

## What changes

**Module headers (Finance, People, Admin…)**
- Rendered as a solid, clearly separated bar: raised surface background, stronger
  text colour and weight, icon in an accent-tinted square.
- The module containing the current page gets an accent left edge and a tinted
  background, so you always see where you are even when several modules are open.
- Each module block is separated from the next by real spacing plus a hairline
  divider, so open groups no longer bleed into each other.

**Section labels (inside a module)**
- Small caps micro-label with a short leading rule, indented under the module,
  clearly quieter than a module header but readable (not the current near-invisible grey).

**Page links**
- Indented one step further with a subtle vertical guide line connecting the
  items of a section, so the nesting is visible at a glance.
- Inactive links get higher-contrast text; hover gets a fuller background.
- The active link keeps the filled pill but adds a small accent dot/edge marker
  so it stands out against a hovered sibling.

**Chrome**
- The header block (wordmark, company switcher, module switcher) gets a divider
  separating it from the nav list.
- Scroll area gets slightly more breathing room and consistent horizontal padding
  so the pills align with the module bars.

Contrast is checked in both light and dark themes.

## Technical notes

- All work in `src/components/app-shell.tsx` (`SidebarModuleGroup`,
  `ModuleHeader`, `SidebarInner`) plus any new tokens in `src/styles.css`.
- Colours use existing Material tokens (`--surface-container`,
  `--surface-container-high`, `--primary-container`, `--on-primary-container`,
  `--primary`) — no hardcoded colour utilities.
- Behaviour is unchanged: collapse/expand state, localStorage persistence,
  role filtering, the icon rail and mobile nav all keep working; the rail gets
  only the matching contrast tweaks for its active state.

No routes, data or permissions change.
