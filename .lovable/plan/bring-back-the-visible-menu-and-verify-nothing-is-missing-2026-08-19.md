# Bring back the visible menu (and verify nothing is missing)

## What's wrong

Since the calm redesign, the desktop navigation is a thin icon-only rail. The section menus (Sales, Billing, Treasury, Accounting, Analysis, Operations, Administration) only appear as small pop-outs on hover — and those pop-outs are being cut off, so in practice no submenu is visible at all.

Cause confirmed in the code: the rail's scrolling nav column uses vertical auto-scroll, which forces horizontal clipping too. The flyout is positioned to the right of the rail, so it lands outside the clipped area and never shows.

## What will change

1. **Fix the clipped flyouts** — render the section pop-out so it can never be cut off by the rail's scroll area, keeping the hover/click behaviour and the same look.

2. **Restore a real, always-visible menu on desktop** — an expandable sidebar with section titles and labelled links (Dashboard, Pipeline, Quotations, Clients, Projects, Sales team, Purchase orders, Invoices, Recurring billing, Accounts, Transactions, Expenses, Suppliers, Plan comptable, Journal, Grand-livre, Balance, Bilan, Compte de résultat, Budgets, Reports, SOPs & Compliance, Companies, Team, Payroll, Users & Access, Settings, About).
   - A toggle switches between the wide labelled sidebar and the slim icon rail; the choice is remembered per user.
   - Default on desktop: wide labelled sidebar, with the section containing the current page expanded and the others collapsed.
   - Mobile keeps the existing drawer, unchanged.

3. **Coverage audit** — check every page in the app appears in the menu for the right roles, so nothing is unreachable:
   - Confirm all existing pages are listed (Axel AI stays hidden while its feature flag is off).
   - Confirm sales-only users still see only Quotations, Clients, Projects, Settings.
   - Confirm Users & Access stays admin-only.

4. **Click-through check** — open each menu entry in the running app and report any page that errors, renders empty, or is missing from navigation, so remaining gaps are listed explicitly rather than assumed.

## Technical notes

- `src/components/app-shell.tsx`: replace `overflow-y-auto overflow-x-visible` on the rail nav with a non-clipping approach (fixed-position flyout anchored to the button, or move scrolling to a wrapper that doesn't clip the popup layer).
- Reuse the existing `SidebarInner` / `SidebarSection` components for the expanded sidebar instead of writing new ones; persist the expanded/rail preference in `localStorage`.
- Section/route definitions and role filtering stay in the existing `sections` array and `useVisibleSections`; no route, data model, or permission logic changes.
