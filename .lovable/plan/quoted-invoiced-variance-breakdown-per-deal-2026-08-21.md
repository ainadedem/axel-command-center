# Quoted → invoiced variance breakdown per deal

Today each pipeline deal shows Quoted / Invoiced / Collected / Outstanding totals, but nothing explains *why* the invoiced figure differs from the quoted one. This adds a variance breakdown that attributes the gap line by line and separates real scope changes from currency effects.

## What you get

**1. Variance summary on every deal**
- New "Variance" figure (invoiced − quoted, in MGA) next to the existing metrics, colour-coded: green when over-quote, red when under-billed, neutral when matched.
- The gap is split into three named causes:
  - **Scope**: value of quoted lines never invoiced, plus invoiced lines that were never quoted.
  - **Price/quantity**: lines that appear on both sides but with a different rate, quantity or discount.
  - **FX**: the part of the difference caused purely by the quote and invoice being valued at different exchange rates (quote FX snapshot vs. current rate), so a deal quoted in EUR and invoiced in EUR is not flagged as under-billed just because MGA moved.
- Percentage of the quote actually invoiced, and a "not yet invoiced" remainder.

**2. Missing line items**
- In the deal drawer, a "Variance" section lists:
  - quoted lines with no matching invoice line ("Not invoiced"),
  - invoice lines with no matching quote line ("Extra / unquoted"),
  - matched lines whose amount changed, showing quoted vs invoiced amount and the delta.
- Lines are matched on description (normalised), falling back to capability + level when descriptions differ; anything unmatched is reported rather than guessed.
- Each row links back to the quotation or invoice it came from.

**3. Variance in the Revenue table**
- A "Variance" column in the pipeline Revenue tab with the signed MGA amount and a small badge when missing line items exist, so under-billed deals surface at a glance.
- Table totals gain a variance row; a filter to show only deals with a non-zero variance.

## Technical notes

- New `src/lib/quote-invoice-variance.ts`: pure functions `matchLines(quotes, invoices)` and `computeVariance(rollup)` returning `{ scope, priceQty, fx, total, missing[], extra[], changed[] }`, all in MGA. Line amounts reuse the existing discount helpers so per-line and global discounts are respected.
- FX component: quote lines valued with `fxRate` / `fxBaseCurrency` when present, otherwise the current `FX` snapshot from `src/lib/fx.ts`; the FX bucket is the difference between the same quote valued at quote-time and at current rates, so scope and price effects stay currency-neutral.
- `OpportunityRollup` in `src/lib/pipeline-link.ts` gains a lazily computed `variance` field; `buildRollups` stays a single pass.
- UI: variance metrics and section added to `src/components/opportunity-revenue-drawer.tsx`; variance column, badge and filter added to the `RevenueView` in `src/routes/_authenticated/pipeline.tsx`. Signed amounts use the existing `SignedAmount` component.
- Invoice lines already live on the `Invoice` model (`lines?: QuoteLine[]`); no migration and no schema change is needed.
- Unit tests for the variance maths (scope vs price vs FX attribution, unmatched lines both ways).

## CSV upload

Send the CSV whenever ready — I'll review its columns first and confirm exactly which records it updates before importing anything.
