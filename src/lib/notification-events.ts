/**
 * Catalogue of notifiable events, shared by the preferences UI, the client
 * dispatcher and the server-side fan-out. Keep the keys stable — they are
 * persisted in `notification_prefs.events`.
 */

export type NotificationEventKey =
  | "board_move"
  | "status_change"
  | "assignment"
  | "comment"
  | "invoice_paid"
  | "invoice_cancelled"
  | "quote_accepted"
  | "ar_escalation";

export interface EventChannels {
  inApp: boolean;
  email: boolean;
}

export interface NotificationEventMeta {
  key: NotificationEventKey;
  label: string;
  description: string;
  /** Default for people directly involved (assignee / creator). */
  defaultInApp: boolean;
  /** Admin-style events that are useful to watch across a whole company. */
  watchable: boolean;
}

export const NOTIFICATION_EVENTS: NotificationEventMeta[] = [
  { key: "board_move", label: "Kanban column moves", description: "A quotation, invoice or PO is dragged to another column.", defaultInApp: true, watchable: true },
  { key: "status_change", label: "Status changes", description: "A document status changes outside the board.", defaultInApp: true, watchable: true },
  { key: "assignment", label: "Assignments", description: "You are added to or removed from a document.", defaultInApp: true, watchable: false },
  { key: "comment", label: "Comments", description: "Someone comments on a card you are involved in.", defaultInApp: true, watchable: true },
  { key: "invoice_paid", label: "Invoice marked paid", description: "An invoice is settled, fully or partially.", defaultInApp: true, watchable: true },
  { key: "invoice_cancelled", label: "Invoice cancelled", description: "An invoice is cancelled or credited.", defaultInApp: true, watchable: true },
  { key: "quote_accepted", label: "Quotation accepted or rejected", description: "A client decision lands on a quotation.", defaultInApp: true, watchable: true },
  { key: "ar_escalation", label: "Receivables escalation", description: "An invoice crosses a step of the collection ladder.", defaultInApp: true, watchable: true },
];

export const EVENT_LABEL: Record<string, string> =
  Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e.key, e.label]));

/** Preference map with sane defaults applied for anything not stored yet. */
export function resolveEventPrefs(stored: unknown): Record<NotificationEventKey, EventChannels> {
  const raw = (stored ?? {}) as Record<string, Partial<EventChannels> | undefined>;
  const out = {} as Record<NotificationEventKey, EventChannels>;
  for (const e of NOTIFICATION_EVENTS) {
    const v = raw[e.key];
    out[e.key] = {
      inApp: typeof v?.inApp === "boolean" ? v.inApp : e.defaultInApp,
      email: typeof v?.email === "boolean" ? v.email : false,
    };
  }
  return out;
}

/** Extra conditions an admin can put on the documents they watch. */
export interface WatchRules {
  /** Only notify when the document amount is at least this (company currency). */
  minAmount?: number;
  /** Watch documents even when the admin is not assigned to them. */
  watchUnassigned?: boolean;
}

export function resolveWatchRules(stored: unknown): WatchRules {
  const raw = (stored ?? {}) as WatchRules;
  return {
    minAmount: typeof raw.minAmount === "number" && raw.minAmount > 0 ? raw.minAmount : undefined,
    watchUnassigned: raw.watchUnassigned !== false,
  };
}
