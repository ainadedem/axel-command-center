import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dbCompanyId } from "@/lib/db-sync";
import { pushNotification } from "@/lib/notifications.functions";
import type { NotificationEventKey } from "@/lib/notification-events";

/**
 * Client side of the notification system: a fire-and-forget dispatcher and a
 * live inbox hook. Delivery decisions (who, in-app vs email) happen on the
 * server, because preferences of other users are not readable from here.
 */

export interface AppNotification {
  id: string;
  kind: string;
  companyId?: string;
  docType?: string;
  docId?: string;
  docNumber?: string;
  title: string;
  body?: string;
  href?: string;
  actorName?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotifyInput {
  kind: NotificationEventKey;
  /** Local company id — translated to the database id automatically. */
  companyId?: string;
  docType?: "quote" | "invoice" | "po" | "opportunity";
  docId?: string;
  docNumber?: string;
  title: string;
  body?: string;
  href?: string;
  recipients?: string[];
  amount?: number;
}

const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());

/** Sends an event out. Never throws — notifications must not break an action. */
export function notify(input: NotifyInput) {
  void (async () => {
    try {
      await pushNotification({
        data: {
          kind: input.kind,
          companyId: input.companyId ? dbCompanyId(input.companyId) ?? null : null,
          docType: input.docType ?? null,
          docId: input.docId ?? null,
          docNumber: input.docNumber ?? null,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? null,
          recipients: input.recipients ?? [],
          amount: input.amount ?? null,
        },
      });
      ping();
    } catch (e) {
      console.warn("[notify]", e);
    }
  })();
}

const fromRow = (r: Record<string, unknown>): AppNotification => ({
  id: r.id as string,
  kind: r.kind as string,
  companyId: (r.company_id as string) ?? undefined,
  docType: (r.doc_type as string) ?? undefined,
  docId: (r.doc_id as string) ?? undefined,
  docNumber: (r.doc_number as string) ?? undefined,
  title: r.title as string,
  body: (r.body as string) ?? undefined,
  href: (r.href as string) ?? undefined,
  actorName: (r.actor_name as string) ?? undefined,
  readAt: (r.read_at as string) ?? undefined,
  createdAt: r.created_at as string,
});

/** Live inbox for the signed-in user, refreshed by realtime and on demand. */
export function useNotifications(limit = 30) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data ?? []).map((r) => fromRow(r as Record<string, unknown>)));
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
    listeners.add(load);
    const channel = supabase
      .channel("notifications-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => { void load(); })
      .subscribe();
    return () => {
      listeners.delete(load);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    const unread = items.filter((n) => !n.readAt).map((n) => n.id);
    if (unread.length === 0) return;
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    await supabase.from("notifications").update({ read_at: now }).in("id", unread);
  }, [items]);

  const clearAll = useCallback(async () => {
    const ids = items.map((n) => n.id);
    if (ids.length === 0) return;
    setItems([]);
    await supabase.from("notifications").delete().in("id", ids);
  }, [items]);

  return { items, loading, unread: items.filter((n) => !n.readAt).length, reload: load, markRead, markAllRead, clearAll };
}
