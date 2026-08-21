# Client colours + Kanban notifications

Three connected pieces: colour-code documents by client, add a real in-app notification feed with optional email, and let each user (especially admins) choose exactly what they get notified about.

## 1. Colour-code by client

- Every client gets a stable colour. If no colour is set, one is derived deterministically from the client id out of a curated 16-colour palette that works in both light and dark themes, so the same client always looks the same everywhere.
- Add an optional colour picker in the client form (Clients page) to override the auto colour, stored on the client record.
- Where the colour shows up:
  - List rows (quotations, invoices, purchase orders, clients, projects, transactions): a 3px coloured left stripe plus a coloured dot next to the client name.
  - Kanban cards (pipeline, quotations, invoices): coloured top accent bar and dot, so a board scan groups visually by client.
  - Client avatars fall back to the client colour instead of a generic tint.
- Colour is decorative only — status/verdict meaning stays in the badges, and every coloured element keeps its text label for accessibility.

## 2. In-app notifications (with optional email)

- New notification centre in the top-bar bell (today it always says "You're all caught up"): unread count badge, grouped list (Today / Earlier), click-through to the exact document, mark one/all as read.
- Events that generate a notification:
  - Kanban column / status change on a quotation, invoice or purchase order (who moved it, from → to).
  - Assignment or unassignment of a quotation/invoice to a person.
  - A comment added on a Kanban card.
  - Invoice marked paid, invoice cancelled, quotation accepted/rejected, and invoice crossing an AR escalation step.
- Recipients per event: the document's assignees and creator, plus any user whose preferences subscribe them to that event for that company. Never notify the person who performed the action.
- Optional email: per event type, a user can pick "In-app", "In-app + email", or "Off". Emails reuse the existing Resend sending path already used for receivables alerts, batched so a burst of board moves doesn't produce a storm.

## 3. Per-user notification preferences

- Settings gets a "Notifications" panel replacing the current receivables-only card: a matrix of event type × channel (in-app / email), plus the existing AR escalation ladder steps.
- Admins additionally get "Watch scope": all companies they administer, or a chosen subset, and an option to be notified about documents they are not assigned to (e.g. every invoice over a chosen amount, every cancellation, every status change on an accepted quotation).
- Sensible defaults so it works with zero configuration: assignments and comments on = in-app; status changes on your own documents = in-app; everything else off.

## Technical notes

- Migration: `clients.color text` (nullable). New `public.notifications` table (id, user_id, company_id, kind, doc_type, doc_id, doc_number, title, body, actor_id, actor_name, read_at, created_at) with GRANTs to `authenticated`/`service_role`, RLS: select/update/delete own rows only; insert restricted to users with access to the row's company. Extend `notification_prefs` with a `events jsonb` column (event key → `{ inApp: bool, email: bool }`) and `watch_company_ids uuid[]`, `watch_rules jsonb`, keeping existing `ar_alerts_enabled`/`stages` untouched.
- `src/lib/client-color.ts`: palette + deterministic hash fallback + resolver used by list, kanban and avatar components.
- `src/lib/notifications.ts`: `notify({ kind, docType, docId, companyId, ... })` resolves recipients (assignees, creator, subscribers via prefs) and inserts rows; called from the existing status helpers (`quote-status.ts`, `invoice-status.ts`, purchase-order `changeStatus`), `board-moves.ts`, assignment handlers, and the card comment action. Fire-and-forget so the optimistic UI stays instant.
- Email fan-out via a server function that reads the recipients' prefs and posts to Resend using the same env keys as `ar-escalation-alerts`; falls back to in-app only when no key is configured.
- New components: `src/components/notification-center.tsx` (bell popover, realtime subscription on the notifications table) and `src/components/notification-settings.tsx` (preferences matrix).
