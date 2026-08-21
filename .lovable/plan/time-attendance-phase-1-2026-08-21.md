# Time & Attendance (Phase 1)

A Jibble-style time tracking module inside a new **People** section, localized for Madagascar (EAT/UTC+3, MGA, local public holidays), wired into Payroll and Projects. No unrelated screens change; existing icons and design tokens stay as they are.

## Navigation

A new **People** group in the rail sits between Analysis and Operations, containing:

- Team (moved from Administration)
- Payroll (moved from Administration)
- Time & Attendance (new)
- Leave (new)
- Kiosk (new, admin/manager entry point)

Administration keeps Companies, Users & Access, Settings, About. Route paths for Team and Payroll stay `/team` and `/payroll`, so links and deep links keep working.

## Clock in / out

- `/time` opens with one large calm pill button: **Clock in** / **Clock out**, showing current status and a live elapsed timer.
- Optional per-clock capture: selfie (camera, resized and stored privately) and GPS coordinates, both opt-in via a company setting; a project and activity note can be attached.
- Missing clock-out from a previous day is surfaced as a quiet flag with a "close entry" action instead of silently running forever.

## Kiosk mode

- `/kiosk` renders a full-screen shared-device view: a searchable grid of company staff, tap a person, enter their PIN, confirm in/out with optional selfie.
- PINs are hashed and verified server-side; the kiosk never receives the hash and never exposes staff data beyond name and photo.
- Kiosk PINs and QR tokens are managed by admins from Time & Attendance settings.

## Live attendance board

- Real-time panel: **In now**, **Out**, **Late** (against the person's schedule), plus today's totals (hours worked, headcount in, late count).
- Managers, HR, and admins see everyone in the active company; employees see only their own row.
- Updates stream live over Realtime, matching the existing notification pattern.

## Timesheets

- Daily / weekly / monthly views per employee, built automatically from closed entries: regular minutes, overtime (beyond the scheduled day), break minutes, leave minutes, with a running total.
- Flags for missing clock-outs, entries with no project, and days below schedule.
- Approval flow: employee **submits** a period, manager/HR **approves**; approved timesheets lock the underlying entries against edits.
- Schedules define working days, start/end time, and unpaid break minutes; a schedule can target a single employee or a role as the default.

## Leave and holidays

- Minimal leave module at `/leave`: request type (paid, unpaid, sick, other), date range, note; manager approval; approved leave contributes leave minutes to timesheets and unpaid leave reduces payroll.
- Madagascar public holidays seeded for the current and next year (recurring fixed dates plus the movable Easter/Pentecost-linked ones entered per year), editable by admins. Weekends come from the schedule's working days.

## Reports and audit (admin / HR only)

- Attendance and hours report filtered by employee, project, and date range; exports to CSV and Excel-compatible files through the existing table export component.
- Every entry permanently records method (`web`, `kiosk`, `pin`), timestamps, and optional photo/GPS. Any edit writes an audit row (who, when, before/after) and edits are blocked once the covering timesheet is approved.

## Integrations

- **Payroll**: when a monthly run is created, approved timesheet totals for that month are pulled in as inputs per employee — regular hours, overtime hours (added to earnings), unpaid leave (deducted). Values are visible and adjustable in the run before validation, and existing runs are untouched.
- **Projects**: project-tagged minutes roll up to per-project hours and cost (using the employee's hourly rate derived from the salary register), shown on the project record, with a billable flag for hours meant for client invoicing.

## Technical notes

- Tables (all `company_id`-scoped instead of `org_id`, to match the app's existing access model; employees are auth users, joined to `team_members` via `user_id` for names and avatars):
  - `time_entries` — company_id, employee_id (auth user), clock_in, clock_out, duration_minutes, project_id, activity, method, photo_url, gps_lat, gps_lng, note, billable, status (`open`/`closed`/`approved`), created_at
  - `timesheets` — company_id, employee_id, period_start, period_end, regular/overtime/break/leave minutes, status (`draft`/`submitted`/`approved`), approved_by, created_at
  - `schedules` — company_id, employee_id null, role null, start_time, end_time, working_days, break_minutes, created_at
  - `kiosk_credentials` — company_id, employee_id, pin_hash, qr_token, created_at
  - `holidays` — company_id, name, date, recurring
  - `leave_requests` — company_id, employee_id, kind, start_date, end_date, paid, status, approver, note
  - `time_entry_audit` — entry_id, actor, action, before/after jsonb, created_at
- Each table gets GRANTs then RLS: employees select/insert their own rows; company managers/HR/admins (via the existing `app_private.has_company_role` helper) read and approve the whole company; audit rows are insert-only and read by admins.
- Clock in/out, kiosk PIN verification, timesheet build/submit/approve, and payroll import run as `createServerFn` handlers with `requireSupabaseAuth` (kiosk PIN check uses a hashed compare server-side), following the existing `*.functions.ts` pattern.
- `time_entries` is added to the Realtime publication for the live board.
- Selfies go to the existing private `documents` bucket under a `time/` prefix, reusing `src/lib/image-resize.ts` and signed URLs.
- All day boundaries, "late", and period math use Indian/Antananarivo (UTC+3); money stays MGA via existing currency helpers.
- UI reuses `Panel`/master-detail, `PageHeader`, `TableExportMenu`, `StatusBadge`, and existing motion utilities; no new icons or color tokens.

## Acceptance checks

- Clock in/out works from the web app and kiosk, with PIN required in kiosk mode and optional selfie/GPS recorded.
- Live board shows in/out/late and today's totals, updating without refresh; employees see only themselves.
- Timesheets compute regular/overtime/break/leave, flag missing clock-outs, and lock on approval.
- Leave requests approve and flow into timesheets; Madagascar holidays appear and are editable.
- Admin reports filter by employee, project, and date range and export to CSV/Excel; every entry keeps its method and audit history.
- Payroll run picks up approved hours and overtime; project time and cost roll up per project.
- Team and Payroll still work at their existing routes; no other screen changes.
