import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, CheckCheck, Circle, Dot, Search, Trash2, X } from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/notifications";
import { EVENT_LABEL, EVENT_GROUPS, groupOfKind, type EventGroupKey } from "@/lib/notification-events";
import { useClients, useQuotes, useInvoices, usePurchaseOrders } from "@/lib/mock-data";
import { usePersistentState } from "@/lib/persistent-state";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "unread" | EventGroupKey;

/** Lowercased, accent-stripped text so "Sté" matches "ste". */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Bell popover: unread badge, search, filters, grouped feed, click-through. */
export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, loading, unread, markRead, markUnread, markAllRead, restoreUnread, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [filter, setFilter] = usePersistentState<FilterKey>("notifications.filter", "all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // Documents referenced by notifications, so search can match the client too.
  const clients = useClients();
  const quotes = useQuotes();
  const invoices = useInvoices();
  const pos = usePurchaseOrders();

  const clientOfDoc = useMemo(() => {
    const byId = new Map(clients.map((c) => [c.id, c]));
    const map = new Map<string, string>();
    const add = (docId: string | undefined, clientId: string | undefined | null) => {
      if (!docId || !clientId) return;
      const c = byId.get(clientId);
      if (c) map.set(docId, [c.name, (c as { displayName?: string }).displayName].filter(Boolean).join(" "));
    };
    for (const q of quotes) add(q.id, q.clientId);
    for (const i of invoices) add(i.id, i.clientId);
    for (const p of pos) add(p.id, (p as { clientId?: string }).clientId);
    return map;
  }, [clients, quotes, invoices, pos]);

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: items.length, unread: items.filter((n) => !n.readAt).length };
    for (const g of EVENT_GROUPS) out[g.key] = items.filter((n) => groupOfKind(n.kind) === g.key).length;
    return out;
  }, [items]);

  const visible = useMemo(() => {
    const base =
      filter === "all"
        ? items
        : filter === "unread"
          ? items.filter((n) => !n.readAt)
          : items.filter((n) => groupOfKind(n.kind) === filter);
    const q = norm(query.trim());
    if (!q) return base;
    const terms = q.split(/\s+/);
    return base.filter((n) => {
      const hay = norm(
        [
          n.title,
          n.body,
          n.docNumber,
          n.actorName,
          EVENT_LABEL[n.kind] ?? n.kind,
          n.docId ? clientOfDoc.get(n.docId) : undefined,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return terms.every((t) => hay.includes(t));
    });
  }, [items, filter, query, clientOfDoc]);


  const today = new Date().toDateString();
  const groups: { label: string; rows: AppNotification[] }[] = [
    { label: "Today", rows: visible.filter((n) => new Date(n.createdAt).toDateString() === today) },
    { label: "Earlier", rows: visible.filter((n) => new Date(n.createdAt).toDateString() !== today) },
  ].filter((g) => g.rows.length > 0);

  const openItem = (n: AppNotification) => {
    void markRead(n.id);
    onClose();
    if (!n.href) return;
    // Links are stored as `/path?focus=…&view=…`; split them for the router.
    const [path, query] = n.href.split("?");
    const search = Object.fromEntries(new URLSearchParams(query ?? ""));
    navigate({ to: path as never, search: search as never }).catch(() => {});
  };

  const onMarkAll = async () => {
    setBusy(true);
    const ids = await markAllRead();
    setBusy(false);
    if (ids.length === 0) return;
    toast.success(`${ids.length} notification${ids.length > 1 ? "s" : ""} marked as read`, {
      action: { label: "Undo", onClick: () => void restoreUnread(ids) },
    });
  };

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    ...EVENT_GROUPS.map((g) => ({ key: g.key as FilterKey, label: g.label })),
  ];

  return (
    <>
      <button
        onClick={() => (open ? onClose() : undefined)}
        aria-hidden
        tabIndex={-1}
        className="hidden"
      />
      {unread > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[var(--destructive,#C5221F)] t-micro leading-[15px] text-center font-semibold text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 mt-2 w-[23rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-0 bg-popover/95 material-panel shadow-[var(--shadow-elevated)] z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
          >
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
              <span className="t-label uppercase tracking-wider text-muted-foreground">
                Notifications{unread > 0 ? ` · ${unread} new` : ""}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void onMarkAll()}
                  disabled={unread === 0 || busy}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                  className="h-7 w-7 grid place-items-center rounded-full hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void clearAll()}
                  disabled={items.length === 0}
                  title="Clear all"
                  aria-label="Clear all notifications"
                  className="h-7 w-7 grid place-items-center rounded-full hover:bg-accent disabled:opacity-40 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="px-2.5 pt-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search client, document number or text…"
                  aria-label="Search notifications"
                  className="h-8 w-full rounded-full border border-border bg-background pl-8 pr-7 t-label outline-none focus:border-primary/50"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center rounded-full text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {query.trim() && (
                <div className="px-1 pt-1 t-micro text-muted-foreground font-tnum">
                  {visible.length} of {items.length} match{visible.length === 1 ? "" : "es"}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-border/60">

              {chips.map((c) => {
                const on = filter === c.key;
                const n = counts[c.key] ?? 0;
                return (
                  <button
                    key={c.key}
                    onClick={() => setFilter(c.key)}
                    aria-pressed={on}
                    className={cn(
                      "px-2.5 py-1 rounded-full t-label border transition-colors press-scale",
                      on
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.label}
                    {n > 0 && <span className="ml-1 opacity-70 font-tnum">{n}</span>}
                  </button>
                );
              })}
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center t-body text-muted-foreground">Loading…</div>
              ) : visible.length === 0 ? (
                <div className="p-8 text-center t-body text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="h-5 w-5 opacity-50" />
                  {items.length === 0
                    ? "You're all caught up."
                    : query.trim()
                      ? `No match for "${query.trim()}".`
                      : "Nothing in this filter."}
                  {query.trim() && (
                    <button onClick={() => setQuery("")} className="t-label text-primary hover:underline">
                      Clear search
                    </button>
                  )}
                </div>

              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <div className="px-3 pt-2.5 pb-1 t-micro uppercase tracking-wider text-muted-foreground">{g.label}</div>
                    {g.rows.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "group relative flex items-stretch border-b border-border/40 last:border-b-0 hover:bg-accent transition-colors",
                          !n.readAt && "bg-[var(--primary-container)]/25",
                        )}
                      >
                        <button
                          onClick={() => openItem(n)}
                          className="min-w-0 flex-1 text-left px-3 py-2.5 flex gap-2.5"
                        >
                          <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", n.readAt ? "bg-transparent" : "bg-primary")} />
                          <span className="min-w-0 flex-1">
                            <span className="block t-micro uppercase tracking-wider text-muted-foreground">
                              {EVENT_LABEL[n.kind] ?? n.kind}
                              {n.docNumber ? ` · ${n.docNumber}` : ""}
                            </span>
                            <span className="block t-body truncate">{n.title}</span>
                            {n.body && <span className="block t-label text-muted-foreground line-clamp-2">{n.body}</span>}
                            <span className="block t-micro text-muted-foreground mt-0.5">
                              {n.actorName ? `${n.actorName} · ` : ""}
                              {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => void (n.readAt ? markUnread(n.id) : markRead(n.id))}
                          title={n.readAt ? "Mark as unread" : "Mark as read"}
                          aria-label={n.readAt ? "Mark as unread" : "Mark as read"}
                          className="w-8 shrink-0 grid place-items-center text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground transition-opacity"
                        >
                          {n.readAt ? <Dot className="h-5 w-5" /> : <Circle className="h-3 w-3 fill-current" />}
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
