import type { NotificationEventKey } from "./notification-events";

/** Payload accepted by the notification fan-out server function. */
export interface FanOutInput {
  kind: NotificationEventKey;
  companyId?: string | null;
  docType?: "quote" | "invoice" | "po" | "opportunity" | null;
  docId?: string | null;
  docNumber?: string | null;
  title: string;
  body?: string | null;
  href?: string | null;
  recipients?: string[];
  amount?: number | null;
  /**
   * Money decisions must reach people even if they never opened the
   * preferences screen: email them unless they explicitly turned it off.
   */
  forceEmail?: boolean;
}
