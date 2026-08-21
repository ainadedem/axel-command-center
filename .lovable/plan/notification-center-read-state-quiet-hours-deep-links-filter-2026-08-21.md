# Notification center: read state, quiet hours, deep links, filters

## What exists today
- The bell already has an unread dot count, a "mark all as read" button and a "clear all" button, but the count and the "mark all" action only cover the 30 notifications currently loaded, and there is no way to mark a single item read without opening it.
- Notification links are page-level only (`/invoices`, `/quotations`, `/purchase-orders`) — they never point at the document that changed, even though the app already supports row deep links via a `focus` URL parameter.
- Settings has per-event in-app/email switches and admin watch rules, but no quiet hours, no digest, and no way to filter the feed.

## 1. Read state that is actually complete
- Exact unread counter from the database instead of the loaded page, shown up to `99+` on the bell.
- "Mark all as read" marks every unread notification for the user, not just the visible ones, with a toast and an Undo.
- Each row gets a hover action to toggle read/unread, and opening a row still marks it read.
- Optimistic updates so the badge reacts instantly; realtime keeps other tabs in sync.

## 2. Quiet hours and daily digest
- New preferences (per user): quiet-hours on/off with a start and end time plus timezone, and an email mode of **Immediate**, **Daily digest**, or **Off** per event.
- In-app notifications always arrive immediately — quiet hours and digests only affect email, so nothing is ever lost.
- During quiet hours (or when the mode is Daily digest) the email is queued instead of sent.
- A scheduled endpoint sends one grouped digest email per user per day, listing the events by type with links, and marks the queue as sent.
- Settings shows a preview line: "Emails paused 20:00–08:00 (Antananarivo) — queued mail arrives with the 08:00 digest".

## 3. Deep links to the exact document
- Every notification stores a link that includes the document id and the view it happened in, e.g. `/invoices?focus=<id>&view=board` for a Kanban move, `?view=list` otherwise.
- The quotations, invoices and purchase-orders pages accept the `view` parameter, switch to that board/list view on load, then scroll to and pulse the card or row (using the existing focus-row behaviour).
- All notification producers are updated: board moves, status changes, assignments, comments, invoice paid/cancelled, quote accepted, AR escalation.

## 4. Event-type filters
- Filter chips at the top of the bell panel: All, Unread, Assignments, Column moves, Comments, Status changes (paid/cancelled/accepted grouped under status). Counts shown per chip; the choice is remembered per user.
- Settings gets the same grouping so events can be toggled as a group as well as one by one, plus a "mute this event everywhere" shortcut.

## Technical notes
- Migration on `public.notification_prefs`: add `quiet_hours jsonb`, `digest_mode jsonb` (per-event email mode) and `time_zone text`, all defaulted so existing rows keep today's behaviour. No changes to `notifications` other than an index on `(user_id, read_at)`.
- New table `public.notification_email_queue` (user_id, notification payload, scheduled_for, sent_at) with RLS restricted to the owner and full access for the service role; the digest job runs with the service role.
- Digest delivery: `src/routes/api/public/notification-digest.ts`, secret-header protected, callable hourly by the scheduler; groups the due queue per user and sends via Resend using the existing sender configuration.
- `src/lib/notifications.server.ts` fan-out decides immediate vs queued; `src/lib/notification-events.ts` gains the event groups and email-mode helpers; `src/lib/notifications.ts` gains `unreadCount`, `markUnread`, server-wide `markAllRead` and a `kinds` filter.
- `src/hooks/use-focus-row.ts` gains a validated `view` search param reused by the three document routes.
