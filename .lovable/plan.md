# Separating company data — two paths, my honest recommendation

You picked **per-company Postgres schemas** (`logia.invoices`, `winford.invoices`, `axiom.invoices`). Before we commit, I have to flag: this is the heaviest possible option and, ironically, it does **not** make role management easier. It makes the data physically separated but role logic still lives in Postgres + RLS the same way.

Below I lay out both paths. Pick one and I'll execute.

---

## Path A — Per-company Postgres schemas (what you asked for)

### What changes

- Create 3 schemas: `logia`, `winford`, `axiom`.
- Move 16 tables out of `public` into each schema (drop `company_id` column — schema = company):
  `accounts, categories, budgets, transactions, invoices, invoice_lines, clients, suppliers, projects, opportunities, quotes, purchase_orders, expenses, recurring_billings, salary_register, payroll_runs`.
- Tables that stay in `public` (cross-company by nature):
  `companies, profiles, user_roles, user_company_access, team_members, sales_members`.
- Migrate existing rows from `public.invoices WHERE company_id = '<log uuid>'` → `logia.invoices`, etc.
- Expose all 3 schemas to the Data API (`db.schemas = ["public","logia","winford","axiom"]` in `supabase/config.toml`).
- New roles table: `app_role` enum gains `super_admin, company_admin, manager, project_manager, sales, finance`. Per-company roles stored in `user_company_access(user_id, company_id, role)`.
- Per-schema RLS using a helper `has_company_role(auth.uid(), '<schema_name>', ARRAY['admin','manager',…])`.

### Frontend rewrite (the painful part)

- Every `supabase.from("invoices")` call becomes `supabase.schema(activeSchema).from("invoices")`. Affected files: `src/lib/db-sync.ts` (~50 call sites), every route that reads/writes directly.
- `db-sync.ts` company-id mapping (`toDbCompanyId` / `companyDbIdByLocal`) is replaced by a `companySchemaByLocal` map. Hydration becomes 3 separate queries per table (one per schema) instead of one query filtered by `company_id`.
- Cross-company views (consolidated dashboard, group-wide reports) require `UNION ALL` across schemas at the app layer or new Postgres views in `public` that union the 3 schemas.
- Generated `src/integrations/supabase/types.ts` will balloon (3× table definitions). It's auto-generated, so we live with that.

### Adding a 4th company later

= new SQL migration creating a whole schema, all tables, all indexes, all RLS policies, plus a config update to expose the schema to the API. Not click-to-add anymore.

### What schemas do NOT solve

Role management. You still need:
- a roles table per (user, company),
- a `has_company_role(...)` function,
- RLS policies on every table referencing it.

The role plumbing is identical between Path A and Path B. Schemas just add a physical separation layer on top.

---

## Path B — Shared tables + per-company role matrix (my recommendation)

Keep current schema. Solve the actual problem (role management) cleanly.

### What changes

1. **Extend the role model** — drop the global `user_roles` rows for non-platform roles, store roles per company:
   ```
   user_company_access(user_id, company_id, role)
     where role ∈ ('company_admin','manager','project_manager','sales','finance','viewer')
   ```
   `user_roles` keeps only `super_admin` (cross-company platform admin).

2. **Helper functions** (security-definer, like the existing `has_company_access`):
   - `has_company_role(_user, _company, _roles text[])` → bool
   - `is_super_admin(_user)` already exists.

3. **Rewrite RLS per table** based on what each role can do:

   | Table | super_admin | company_admin | manager | project_manager | sales | finance |
   |---|---|---|---|---|---|---|
   | invoices, transactions, expenses, recurring_billings, budgets, accounts | RW | RW | RW | R | R | RW |
   | quotes, purchase_orders, opportunities, clients | RW | RW | RW | RW | RW | R |
   | projects | RW | RW | RW | RW | R | R |
   | salary_register, payroll_runs | RW | RW | R | — | — | RW |
   | suppliers, categories | RW | RW | RW | R | R | RW |
   | team_members, sales_members | RW | R | R | R | R | R |

   (Confirm/tweak this matrix before we build.)

4. **Admin UI** in the More panel:
   - List of users × companies × role dropdown.
   - Super admin can grant/revoke; company_admin can manage roles inside their own company only.

5. **No frontend data-layer rewrite.** `db-sync.ts`, all 18 stores, all routes keep working unchanged. RLS does the filtering as today.

### Trade-off

Data is logically — not physically — isolated. A bug in an RLS policy could leak rows across companies (this is also true today). Mitigated by: tests on `has_company_role`, the `company_id` column staying as defense-in-depth, and reviewing each policy before merge.

---

## Recommendation

**Path B.** It solves your stated goal ("manage easier access roles") directly with one migration + one admin UI. Path A is ~10× the work, breaks cross-company reporting, complicates adding new companies, and still requires the entire Path B role system inside each schema.

Choose Path A only if you have a hard requirement that I'm missing — e.g. each company is a separate legal entity that must be physically isolatable for export/backup, or you plan to host companies on different Postgres instances later.

---

## Next step

Reply with **A** or **B** (and any tweaks to the role matrix if B). Then I switch to build mode and execute.
