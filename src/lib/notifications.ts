import { useCallback, useEffect, useRef, useState } from "react";
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
export function useNotifications(limit = 40) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const userIdRef = useRef<string | undefined>(undefined);
  // Bumped on identity changes so the channel is rebuilt for the new user.
  const [session, setSession] = useState(0);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSession((s) => s + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);


  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    userIdRef.current = uid;
    if (!uid) { setItems([]); setUnread(0); setLoading(false); return; }
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null),
    ]);
    setItems((data ?? []).map((r) => fromRow(r as Record<string, unknown>)));
    // The exact count comes from the database, not just the loaded page.
    setUnread(count ?? 0);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let recount: ReturnType<typeof setTimeout> | undefined;
    listeners.add(load);

    /** Re-reads the exact unread count so optimistic maths never drifts. */
    const scheduleRecount = (uid: string) => {
      if (recount) clearTimeout(recount);
      recount = setTimeout(() => {
        void supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .is("read_at", null)
          .then(({ count }) => { if (!cancelled) setUnread(count ?? 0); });
      }, 400);
    };

    void (async () => {
      await load();
      const uid = userIdRef.current;
      if (cancelled || !uid) return;
      // One filtered channel per user: only this inbox's rows come down the wire.
      channel = supabase
        .channel(`notifications-inbox-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          (payload) => {
            if (cancelled) return;
            if (payload.eventType === "INSERT") {
              const row = fromRow(payload.new as Record<string, unknown>);
              setItems((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, limit)));
              if (!row.readAt) setUnread((u) => u + 1);
            } else if (payload.eventType === "UPDATE") {
              const row = fromRow(payload.new as Record<string, unknown>);
              setItems((prev) => prev.map((n) => (n.id === row.id ? row : n)));
            } else if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string })?.id;
              if (id) setItems((prev) => prev.filter((n) => n.id !== id));
            }
            scheduleRecount(uid);
          },
        )
        .subscribe((status) => {
          // Socket dropped and recovered — resync the page we may have missed.
          if (status === "SUBSCRIBED") void load();
        });
    })();

    return () => {
      cancelled = true;
      if (recount) clearTimeout(recount);
      listeners.delete(load);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, limit]);


  /** Flip one item read or unread (optimistic, reconciled by the reload). */
  const setRead = useCallback(async (id: string, read: boolean) => {
    const at = read ? new Date().toISOString() : null;
    let changed = false;
    setItems((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        changed = Boolean(n.readAt) !== read;
        return { ...n, readAt: at ?? undefined };
      }),
    );
    if (changed) setUnread((u) => Math.max(0, u + (read ? -1 : 1)));
    await supabase.from("notifications").update({ read_at: at }).eq("id", id);
  }, []);

  const markRead = useCallback((id: string) => setRead(id, true), [setRead]);
  const markUnread = useCallback((id: string) => setRead(id, false), [setRead]);

  /**
   * Marks *every* unread row for the user, not only the loaded page. Returns
   * the ids that changed so the caller can offer an Undo.
   */
  const markAllRead = useCallback(async (): Promise<string[]> => {
    const uid = userIdRef.current;
    if (!uid) return [];
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    const { data } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", uid)
      .is("read_at", null)
      .select("id");
    return (data ?? []).map((r) => r.id as string);
  }, []);

  /** Undo for {@link markAllRead}. */
  const restoreUnread = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: null }).in("id", ids);
    await load();
  }, [load]);

  const clearAll = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    setItems([]);
    setUnread(0);
    await supabase.from("notifications").delete().eq("user_id", uid);
  }, []);

  return { items, loading, unread, reload: load, markRead, markUnread, markAllRead, restoreUnread, clearAll };
}

