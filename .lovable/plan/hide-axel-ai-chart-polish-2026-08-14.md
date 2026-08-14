# Hide Axel AI + chart polish

## 1. Hide the Axel AI feature

Hide it behind a single feature flag so it can be re-enabled in one line later — no code deleted.

- Add a `AXEL_AI_ENABLED = false` flag in a small config module.
- Remove the "Axel AI" entry from the sidebar navigation when the flag is off.
- Remove the "New conversation" mapping used by the top-bar "New" button for `/axel`.
- Make `/axel` and `/axel/:threadId` redirect to the dashboard while disabled, so old links or bookmarks don't land on a hidden page.
- Leave the chat route/API and stored threads untouched.

## 2. Chart rounded corners and design consistency

Charts currently live on three pages (Dashboard, Reports, Invoices) and all use the shared `ChartFrame` card.

- Fix the one bar missing rounding: the stacked "Closed" bar in the Dashboard sales chart renders square. Apply bottom rounding to the base segment of the stack so the whole column reads as one rounded bar.
- Give every bar series the same corner radius and bar width/gap settings by moving those values into shared chart defaults instead of repeating `radius={[8,8,0,0]}` per chart, so new charts inherit them automatically.
- Round the chart plotting surface: clip the chart body inside the card's rounded container so grid lines and bars never touch square edges.
- Align remaining visual details across the three chart cards: consistent card padding, header spacing, legend swatch style, axis tick color/size, grid opacity, and tooltip styling pulled from the shared chart tokens.

## Technical notes

- Files touched: `src/components/app-shell.tsx`, `src/lib/create-action.ts` (New-button mapping), `src/routes/_authenticated/axel.index.tsx`, `src/routes/_authenticated/axel.$threadId.tsx`, `src/components/charts.tsx`, `src/routes/_authenticated/index.tsx`, `src/routes/_authenticated/reports.tsx`, `src/routes/_authenticated/invoices.tsx`.
- No database or backend changes.
