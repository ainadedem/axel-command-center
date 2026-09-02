# Make Tasks real (create, assign, link, complete)

## Why it doesn't work today

The **Tasks** page is still a placeholder: it renders a mock table with a non-functional "New task" button, and there is no tasks table in the database, so nothing can be saved. **My tasks** only shows derived to-dos (pending approvals, next actions) — it has no user-created tasks either.

## What gets built

### Task records
A new `tasks` table storing: title, optional notes, status (To do / In progress / Blocked / Done), priority (Low / Normal / High / Urgent), due date, assignees, the company it belongs to, who created it, and optional links to a project, client, quotation, invoice or payment request.

Access follows the existing rules: you see tasks for companies you have access to; sales users see only tasks they created or are assigned to, and only client/project/quotation links (no finance documents).

### Tasks page
Rebuilt on the shared Projects-style shell used elsewhere:
- KPI strip: open, due this week, overdue, assigned to me, completed this month.
- Toolbar with search, status/priority/assignee/project filters, and saved views.
- List table with inline status change, priority chip, due-date chip (red when overdue), assignee avatars and linked-document chips.
- Click a row to open the detail panel: edit everything, add notes, see the activity trail.
- **New task** dialog: title, assignees (up to 3, same picker as quotations), due date, priority, company, and an optional link picked with the existing searchable document-number picker.
- Optional Kanban board by status, draggable like the other boards.

### My tasks
Adds a third section, **My tasks**, listing tasks assigned to or created by you, above the existing approvals and business to-dos, so one page shows everything waiting on you.

### Create-anywhere
- The global "New" button on the Tasks page creates a task.
- "Add task" action on a project's detail panel, pre-linked to that project.

### Notifications and audit
Assigning a task, changing its status and completing it write an activity entry and notify the assignees, reusing the existing notification and audit machinery.

## Technical notes

- Migration: `public.tasks` (uuid id, company_id, title, notes, status, priority, due_date, assigned_to uuid[], project_id, client_id, quote_id, invoice_id, payment_request_id, created_by, timestamps) with GRANTs for `authenticated`/`service_role`, RLS enabled, and policies scoped through the existing company-access helper plus a creator/assignee clause for sales.
- Data layer: `Task` type and `tasksStore` in `src/lib/mock-data.ts`, row mapping in `src/lib/db-sync.ts`, realtime subscription like other collections.
- New `src/lib/tasks.ts` for status labels, overdue math, filtering and KPI rollups.
- Rewrite `src/routes/_authenticated/tasks.tsx` on `ProjectsStylePageShell` with `DataToolbar` / `ListTable` / `MasterDetail`; new `src/components/task-dialog.tsx`.
- Register the create action in `src/lib/create-action.ts`; extend `src/routes/_authenticated/my-tasks.tsx`; add task events to `src/lib/notification-events.ts` and `src/lib/document-activity.ts`.
