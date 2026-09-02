# Automatic project sequencing, progress, and KPIs

Every new project instantly gets a ready-made workflow from quote to cash, a progress bar showing how far it is, and KPI cards showing money, schedule, and delivery health.

## Default sequence (auto-created with every project)

A blend of the commercial chain and the delivery chain:

```text
1. Quote          6. Delivery
2. PO             7. PVR / acceptance
3. Kickoff        8. Invoice
4. Execution      9. Paid
5. Review
```

Each stage holds: order, name, status (Pending / In progress / Blocked / Done / Skipped), owner, planned start & due date, completion date, and notes.

## What happens automatically

- Creating a project seeds the 9 stages in order, all Pending, first stage set to In progress.
- Stages that already have evidence auto-complete instead of waiting on a manual click:
  - a linked quote accepted -> Quote done
  - a linked/waived PO -> PO done
  - a signed PVR record -> PVR done
  - an invoice issued for the project -> Invoice done
  - the invoice fully paid -> Paid done
- Manual stages (Kickoff, Execution, Review, Delivery) are toggled by the user; blocked stages carry a short reason.
- Stage changes are written to the existing document activity/audit trail and raise the same in-app notifications used elsewhere.

## Progress bar

Completion % = done stages / applicable stages (skipped stages drop out of the denominator). Shown as:
- a slim bar on each project row in the list table,
- a large bar with stage chips in the project detail panel,
- an aggregate "portfolio progress" bar in the KPI strip.

## KPIs on the Projects page

Money: revenue, cost, margin %, invoiced, paid, outstanding.
Schedule: days in current stage, overdue stages, projects at risk, expected cash date.
Delivery health: PO missing / waived, PVR signed, quote-to-invoice conversion gap, blocked count.

Each KPI card is clickable and filters the list beneath it.

## Templates

The 9-stage sequence lives in an editable per-company template, so the stage list, names, and order can be adjusted without code. Existing projects can be back-filled with the template on demand from a banner on the Projects page.

## Technical notes

- Migration adds `public.project_stage_templates` (company-scoped, JSON stage definitions, one default row seeded per company) and `public.project_stages` (project_id, position, key, name, status, owner, planned_start, due_date, completed_at, blocked_reason, notes) with GRANTs to `authenticated` / `service_role`, RLS enabled, and policies matching the existing company-access model used by `projects`.
- New `src/lib/project-stages.ts`: template definition, `seedStagesForProject`, `deriveAutoStatuses` (reads quotes, purchase_orders, pvr_records, invoices already in the store), progress math, and stage transition writes through the existing critical-collection store so money-adjacent rows keep the saving/saved/error semantics.
- New `src/lib/project-kpis.ts` computing the money / schedule / health metrics, reusing `invoice-money.ts` and `aging.ts` rather than re-deriving totals.
- New `src/components/project-progress.tsx` (compact bar for rows, full stage timeline for the detail panel) and `src/components/project-stage-list.tsx` for stage editing.
- `src/routes/_authenticated/projects.tsx` keeps the Projects-style shell: KPI strip gains the new cards, the list table gains a Progress column and a Stage column, and the detail panel gains a Workflow tab. Project creation calls `seedStagesForProject`.
- Back-fill banner runs the same seeding for projects with no stages, guarded so it never duplicates.
- Stage transitions log via `src/lib/document-activity.ts` and notify via `src/lib/notification-events.ts`.
