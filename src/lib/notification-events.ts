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
  | "quote_auto_documents"
  | "ar_escalation"
  | "payment_request_decision"
  | "payment_run_reminder";

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
  { key: "quote_auto_documents", label: "Documents created from an accepted quotation", description: "Accepting a quotation automatically creates its purchase order and invoice.", defaultInApp: true, watchable: true },
  { key: "payment_request_decision", label: "Payment approval decisions", description: "A payment request is reviewed, approved, rejected or paid.", defaultInApp: true, watchable: true },
  { key: "payment_run_reminder", label: "Weekly payment run reminders", description: "Wednesday cut-off reminder and the Thursday approval summary.", defaultInApp: true, watchable: true },
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

/* ------------------------------------------------------------------ groups */

export type EventGroupKey = "assignment" | "board_move" | "comment" | "status";

export interface EventGroup {
  key: EventGroupKey;
  label: string;
  kinds: NotificationEventKey[];
}

/** Coarse buckets used by the inbox filter chips and the settings toggles. */
export const EVENT_GROUPS: EventGroup[] = [
  { key: "assignment", label: "Assignments", kinds: ["assignment"] },
  { key: "board_move", label: "Column moves", kinds: ["board_move"] },
  { key: "comment", label: "Comments", kinds: ["comment"] },
  {
    key: "status",
    label: "Status changes",
    kinds: ["status_change", "invoice_paid", "invoice_cancelled", "quote_accepted", "quote_auto_documents", "ar_escalation"],
  },
];

export const groupOfKind = (kind: string): EventGroupKey | undefined =>
  EVENT_GROUPS.find((g) => (g.kinds as string[]).includes(kind))?.key;

/* ------------------------------------------------- email mode / quiet hours */

/** How email for one event should be delivered. */
export type EmailMode = "off" | "immediate" | "digest";

export const EMAIL_MODE_LABEL: Record<EmailMode, string> = {
  off: "Off",
  immediate: "Immediate",
  digest: "Daily digest",
};

/**
 * Email mode per event. Legacy rows only stored a boolean `email` flag, so it
 * is used as the fallback: true → immediate, false → off.
 */
export function resolveEmailModes(
  storedModes: unknown,
  channels: Record<NotificationEventKey, EventChannels>,
): Record<NotificationEventKey, EmailMode> {
  const raw = (storedModes ?? {}) as Record<string, unknown>;
  const out = {} as Record<NotificationEventKey, EmailMode>;
  for (const e of NOTIFICATION_EVENTS) {
    const v = raw[e.key];
    out[e.key] =
      v === "off" || v === "immediate" || v === "digest"
        ? v
        : channels[e.key]?.email
          ? "immediate"
          : "off";
  }
  return out;
}

export interface QuietHours {
  enabled: boolean;
  /** Minutes from midnight, local to {@link QuietHours.timeZone}. */
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  timeZone?: string;
}

export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, start: "20:00", end: "08:00" };

export function resolveQuietHours(stored: unknown, timeZone?: string | null): QuietHours {
  const raw = (stored ?? {}) as Partial<QuietHours>;
  const valid = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : undefined);
  return {
    enabled: raw.enabled === true,
    start: valid(raw.start) ?? DEFAULT_QUIET_HOURS.start,
    end: valid(raw.end) ?? DEFAULT_QUIET_HOURS.end,
    timeZone: raw.timeZone || timeZone || undefined,
  };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Wall-clock minutes in a timezone, without pulling in a date library. */
export function minutesInZone(at: Date, timeZone?: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: timeZone || undefined,
    });
    const [h, m] = fmt.format(at).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

/** True when `at` falls inside the quiet window (handles overnight windows). */
export function isQuiet(q: QuietHours, at: Date = new Date()): boolean {
  if (!q.enabled) return false;
  const now = minutesInZone(at, q.timeZone);
  const s = toMinutes(q.start);
  const e = toMinutes(q.end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

/** Next moment the user is reachable again — when the quiet window ends. */
export function quietEndsAt(q: QuietHours, at: Date = new Date()): Date {
  const now = minutesInZone(at, q.timeZone);
  const e = toMinutes(q.end);
  let delta = e - now;
  if (delta <= 0) delta += 24 * 60;
  return new Date(at.getTime() + delta * 60_000);
}

/** When the next daily digest for this user should go out. */
export function nextDigestAt(q: QuietHours, at: Date = new Date()): Date {
  // Digests ride on the end of the quiet window when set, otherwise 08:00.
  const target = q.enabled ? toMinutes(q.end) : toMinutes("08:00");
  const now = minutesInZone(at, q.timeZone);
  let delta = target - now;
  if (delta <= 0) delta += 24 * 60;
  return new Date(at.getTime() + delta * 60_000);
}

