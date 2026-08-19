# Gemini-calm redesign — remaining pass

The canvas, corner gradient, icon rail, floating panels, pill search/actions and the master–detail layout on invoices, quotations, clients and projects are already in place. This pass closes the gaps so the whole app — not just those four screens — reads as light, spacious and calm.

## What changes

**0. Gemini palette and type**
- Retune the tokens to Gemini's atmosphere: a near-white canvas, one step lighter surface for panels, near-black primary text, soft grey secondary text, and hairline dividers only where truly needed.
- Accent moves to Gemini blue used sparingly (selected row tint, focus ring, primary pill action); the corner wash becomes a blue-to-lavender ambient fade at very low saturation.
- Status colours stay semantic (paid / overdue / warning) but drop to quieter, desaturated tones shown as text or soft chips rather than loud badges.
- Typography moves to a Google-Sans-adjacent pairing loaded from Google Fonts, with lighter heading weights, roomier line height, and a slightly larger base size for calm reading. Numbers keep tabular figures.



**1. Room to breathe everywhere**
- Raise the page gutter and vertical rhythm on all screens so panels sit inside the canvas instead of touching the edges, with a comfortable max content width on very wide displays.
- Increase the gap between stacked panels and grid cards app-wide (same treatment already applied to the dashboard).

**2. Every table sits in one floating panel**
- Wrap the table shell used by the single-list screens (transactions, expenses, suppliers, accounts, journal, grand-livre, balance, budgets, payroll, team, companies, purchase orders, plan comptable, sops, users & access) in the soft rounded panel with generous internal padding, no hard border, and quiet borderless rows.
- Keep row height and number density as-is so finance figures stay scannable.

**3. Quiet headers**
- Page headers become a light title block on the left with small pill-style actions and status on the right; remove heavy toolbar framing and boxed filter bars, letting filters live as pill chips with space around them.

**4. Master–detail extended**
- Apply the same two-panel arrangement to the remaining list-plus-item screens: suppliers, purchase orders, team and sales team, so selecting a row opens the focused work panel (bottom sheet on mobile).

**5. Calm loading and empty states**
- Replace spinner-style waits on lists and cards with the existing shimmer skeleton, respecting reduced-motion.
- Empty, no-match and error states already float as panels; align their spacing with the new scale.

**6. Motion polish**
- One shared 150ms soft-ease transition for hover, selection and panel entry; fades and tone changes only, no abrupt movement.

## Out of scope
No changes to data model, routes, business logic, icons or design tokens. Colours, fonts and semantic tokens stay exactly as they are.

## Technical notes
- Spacing and panel treatment go through the existing `panel`, `panel-pad`, `quiet-row`, `pill-field` and `pill-chip` utilities in `src/styles.css` — no new colour tokens.
- Table containment is done once in `src/components/list-table.tsx` (`ListTableShell`) and `src/components/stacked-table.tsx`, so all single-list routes inherit it.
- Header changes are made once in `src/components/page-header.tsx` plus the shared filter/toolbar components.
- New master–detail wiring reuses `src/components/master-detail.tsx` exactly as invoices/quotations already do (local `selectedId` state, row click handler).
- Verification: Playwright pass over the dashboard, one single-list screen and each new master–detail screen to confirm layout, no runtime errors, and readable data density.
