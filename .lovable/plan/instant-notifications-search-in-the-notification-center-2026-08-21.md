# Instant notifications + search in the notification center

## What you get

1. New notifications appear in the bell and the notification center the moment they happen — no refresh, no tab switch. The unread badge updates live, and read/unread state stays in sync if you act on the same notification in another tab or device.
2. A search box at the top of the notification center that filters the feed as you type, matching client name, document number (quote/invoice/PO), and the event text (title, body, who did it, event type). Search works together with the existing filter chips.

## Real-time delivery

The inbox hook already opens a Supabase Realtime channel, but the `notifications` table is not published for real-time, so nothing ever arrives — the feed only updates when something in the app re-triggers a fetch.

- Add `public.notifications` to the real-time publication and set replica identity so updates carry the row.
- Scope the subscription to the signed-in user (`user_id=eq.<uid>`) so each browser only receives its own rows; row-level security already restricts reads to the owner.
- Apply incoming events directly to local state instead of refetching the whole list on every event: insert prepends the new row and bumps the unread badge, update patches the row in place, delete removes it. A short debounce reconciles the exact unread count from the database so the badge never drifts.
- Keep the current manual refresh path as a fallback when the socket is down, and re-subscribe on sign-in/sign-out.

## Search in the notification center

- A search input sits under the header, above the filter chips, with a clear button and count of matches ("12 of 40").
- Matching is case- and accent-insensitive across: notification title, body, document number, actor name, and the human event label.
- Client name: notifications reference the document (`doc_type` + `doc_id`), so the center resolves the client for quotations, invoices and purchase orders from the already-loaded document stores and includes both the client name and short display name in the searchable text.
- Search combines with the active chip (e.g. "Comments" + "Airtel"), keeps the Today/Earlier grouping, and shows an empty state offering to clear the search when nothing matches.
- The query is not persisted between sessions; the chip filter stays persisted as today.

## Technical notes

- Migration: `ALTER TABLE public.notifications REPLICA IDENTITY FULL;` and `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`
- `src/lib/notifications.ts`: filtered channel per user, event-level state patching, debounced unread recount, channel teardown on unmount (no duplicate subscriptions).
- `src/components/notification-center.tsx`: search state, normalized match helper, searchable-text builder that joins event text with client/document lookups, updated empty state and result count.
- Client/document lookup reuses the existing quotes/invoices/purchase-order stores and client records already available to the shell; no extra network calls per notification.
