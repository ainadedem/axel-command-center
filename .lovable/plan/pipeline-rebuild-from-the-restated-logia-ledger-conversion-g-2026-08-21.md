# Pipeline rebuild from the restated Logia ledger + conversion gap tracking

Two parts: (1) rebuild the Logia pipeline so it reflects the ledger imported through 17 Aug 2026 and link the billing documents to deals, (2) add a "conversion gap" summary showing draft invoices and quotations not yet sent, broken down by client and project.

## Part 1 — Rebuild the Logia pipeline

Current state (verified): Logia has 69 opportunities, 63 invoices and 11 quotations, and **not a single invoice or quote is linked to an opportunity** (`opportunity_id` is null everywhere, all companies). So pipeline revenue roll-ups currently show zero.

What will change, Logia only (Winford and Axiom untouched):

- Rebuild Logia deals from the restated ledger: one deal per client + revenue engagement found in the Jan–Aug 2026 sales entries, valued at the restated invoiced amount in MGA, with the stage derived from reality:
  - fully paid invoices -> Closed
  - invoiced, partly/not paid -> In progress
  - quotation only, sent/accepted -> Proposal / Negotiation
  - quotation rejected/expired -> Lost
- Expected close date taken from the last invoice/quote date of the deal.
- Link every restated Logia invoice and quotation to its deal (`opportunity_id`), matching on client + subject + period, and carry the project link across so a deal knows its project.
- Deals that exist today and match a rebuilt deal keep their id, owner/closer, probability and any manual edits; only value, stage and links are restated. Deals with no ledger evidence are kept but flagged rather than deleted.
- Same linking rule applied going forward for Winford/Axiom documents when they are saved (already-existing `ensureOpportunityForQuote` path), so new quotes stay inside the pipeline.

## Part 2 — Conversion gap: not invoiced / not sent

Two counters, side by side, both money and count, in MGA:

- **Draft invoices** — invoice exists but status is still Draft (created, never sent).
- **Awaiting invoicing** — quotation sent or accepted with no invoice raised against it yet.
- Plus a third small chip: **Quotations not sent** (still Draft).

Each counter shows: number of documents, total value, and oldest document age in days so stale items surface.

Breakdown table, groupable by **Client** and by **Project** (toggle), columns:
Client / Project · Quotes not sent · Quotes awaiting invoice · Draft invoices · Total value at risk. Rows expand to the underlying documents and clicking one deep-links to that invoice or quotation row (reusing the existing focus-row deep link used by the aging drawer).

Where it appears:
- **Dashboard**: three compact KPI chips (Quotes not sent, Awaiting invoicing, Draft invoices) that open the full breakdown.
- **Pipeline page**: a new "Conversion" panel with the counters and the client/project breakdown table.
- When a quotation is pushed to invoicing, the resulting toast states how many documents remain in each gap, so the count is visible at the moment of conversion.

Scoped to the active company and respecting the sales role restrictions (a sales user only sees their own quotations in these figures).

## Technical notes

- Data restatement runs as a one-off SQL migration/backfill against `opportunities`, `invoices.opportunity_id` and `quotes.opportunity_id`, derived from `journal_entries` (the ledger already imported) plus the existing derived invoices. `logia-opportunities-seed.json` is regenerated from the same result so the offline seed and backend agree, and the derived-data version in `src/lib/pcg.ts` is bumped so clients re-hydrate.
- New pure module `src/lib/conversion-gap.ts`: computes the buckets and the per-client / per-project rollups from the in-memory stores, MGA via `toMGA`, invoice money via `invoice-money.ts`, quote money via `quotePayable`. Unit tests added under `src/lib/__tests__`.
- New `src/components/conversion-gap-panel.tsx` (counters + grouped table) reused by the Pipeline page and by the dashboard chips' drawer, styled with the existing `KpiCard` / `PanelCard` / drawer patterns.
- No schema change expected beyond data: `opportunity_id` already exists on `invoices` and `quotes`.
