# Link sales to quotations — bidirectional + role tags

Today a quotation's link to its sales deal lives only inside the edit dialog (an "Opportunity" selector), and the read-only detail panel shows nothing about the deal or the sales roles. The pipeline deal drawer already links *out* to quotations, but the reverse — opening the deal from a quotation — is missing, the Sales team page doesn't surface its members' quotations, and quotations don't show who the Acquisition / Closer is.

This makes the link visible and clickable in both directions, and tags each quotation with its sales roles.

## What changes

**1. Quotation → deal (clickable link)**
- In the quotation **detail panel** (`DetailPanel` in `quotations.tsx`), add a "Pipeline deal" row that shows the linked opportunity name as a clickable link to `/pipeline` with an `opp=<id>` search param. When no deal is linked, show a muted "No deal linked" with an "Edit" affordance.
- In the **edit dialog**, next to the existing `OpportunitySelect`, when an opportunity is already chosen show a small "Open in pipeline" link.
- **Pipeline route** (`pipeline.tsx`): add `opp` to `validateSearch` and an effect that calls `openDocs(opportunity)` (opening the `OpportunityRevenueDrawer`) when the param is present on mount/navigation, then clears it so the drawer isn't forced open on every visit.

**2. Sales → quotation (link from sales)**
- The pipeline deal drawer already links each quotation to `/quotations?focus=<id>` — no change there.
- **Sales team page** (`sales-team.tsx`): each member card already shows "clients" and "deals" counts. Add a "Quotes" count linking to `/quotations?sales=<id>`, where `<id>` is the member's identity (their auth `userId` if they're an app user, else their team-member name).
- **Quotations route**: accept a `sales` search param (alongside the existing `focus`) and filter the list to quotations where `assignedTo` includes that userId **or** the client's `acquisition` name matches the member's name. When the filter is active, show a clear "Filtered by: <name>" chip with a clear button (matching the existing filter-active pattern).

**3. Sales role tags on quotations (Acquisition / Closer)**
- Add a small `QuoteSalesRoles` component rendering two role-tagged chips:
  - **Acquisition** — derived from `client.acquisition` (single source of truth; read-only here, links to the client to edit).
  - **Closer** — derived from the linked `opportunity.closer`; "—" when no deal is linked.
- Show these chips on the quotation **detail panel** (a new `DetailSection` "Sales"), the **list row** (compact, in a new optional "Roles" column or appended to the owner cell), and the **Kanban card**.
- In the **edit dialog**, when a deal is linked, add an editable "Closer" picker (reusing `useSalesPeople("closer")` like the OpportunityDialog) that writes the chosen name to the linked opportunity's `closer` field via `opportunitiesStore.update`. When no deal is linked, the closer field is disabled with a hint to link a deal first.
- Acquisition stays read-only on the quote (it's the client's); the chip links to the client record to change it.

## Technical notes

- **No schema migration.** `opportunity.closer` and `client.acquisition` already exist and sync via `db-sync.ts` (`opportunityToDb`/`opportunityFromDb`); `quote.assignedTo` and `quote.opportunityId` already sync. All changes are client-side.
- **Pipeline deep-link**: extend `validateSearch` in `pipeline.tsx` to allow `{ opp?: string }`; add a `useEffect` that, when `opp` is set and matches a loaded opportunity, calls `openDocs(opp)` then `navigate({ search: (prev) => ({ ...prev, opp: undefined }) })` to clear it.
- **Quotations filter**: extend `validateSearch` (currently `focusSearch`) to also accept `sales?: string`; apply the filter inside the existing `baseList`/`view.state.filters` pipeline so it composes with status chips and presets.
- **QuoteSalesRoles**: new small file `src/components/quote-sales-roles.tsx`. Acquisition chip uses `Target` icon (sky), closer chip uses `Handshake` icon (emerald) — mirroring the `ROLE_STYLES` already used on the Sales team page for visual consistency.
- **Sales team "Quotes" count**: compute from `useQuotes()` filtered by `assignedTo` includes the member's userId (app user) OR `client.acquisition === member.name`.
