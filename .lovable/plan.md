# Simplify client grid cards

## Goal
Reduce the `ClientCard` (grid view) to the bare minimum so cards are compact and breathe — the full details already surface in the `DetailPanel` when a client is clicked.

## Current state (confirmed by reads)
- `ClientCard` lives in `src/routes/_authenticated/clients.tsx` (lines 340–437).
- It currently renders: avatar, name, lead/overdue/outstanding/healthy badge, industry · country line, email · phone line, category chips, company tags, a 3-col stat grid (Revenue / Outstanding / Margin), and a footer row of inv/txn/proj counts.
- The `DetailPanel` (lines 184–210) already shows email, phone, project/invoice counts, and (for non-sales) invoiced/paid/outstanding amounts.

## Change (single file: `src/routes/_authenticated/clients.tsx`)
Simplify `ClientCard` to keep only essentials on the card face:

1. **Keep:** avatar (with company dot), name, and a single status chip — Lead / Overdue / Outstanding / Healthy (already there, keep it).
2. **Keep:** one muted secondary line — company name (or industry if no company). Drop the separate industry·country and email·phone lines.
3. **Remove:** the `CategoryChips` and `CompanyTags` row (categories + multi-company tags) from the card face.
4. **Remove:** the 3-column `StatMini` grid (Revenue / Outstanding / Margin) and the lead "Lead from the pipeline…" footnote.
5. **Remove:** the footer counts row (inv / txn / proj).
6. **Keep:** the hover action pills (Promote / Edit / Delete) exactly as-is.
7. Keep the card's `onClick` → `onSelect` so the detail panel still opens; keep `selected` ring and lead styling.

Net effect: each card is a single row (avatar + name + one status chip + one muted line) with hover actions — minimal, scannable, and consistent with the Gemini-calm aesthetic. No changes to the list view, detail panel, data model, or logic.

## Verification
- Run `tsgo` typecheck after the edit.
- Visually confirm cards render compactly and the detail panel still opens on click (Playwright screenshot of `/clients`).
