import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/notifications";
import { EVENT_LABEL } from "@/lib/notification-events";
import { cn } from "@/lib/utils";

/** Bell popover: unread badge, grouped feed, click-through to the document. */
export function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, loading, unread, markRead, markAllRead, clearAll } = useNotifications();
  const navigate = useNavigate();

  const today = new Date().toDateString();
  const groups: { label: string; rows: AppNotification[] }[] = [
    { label: "Today", rows: items.filter((n) => new Date(n.createdAt).toDateString() === today) },
    { label: "Earlier", rows: items.filter((n) => new Date(n.createdAt).toDateString() !== today) },
  ].filter((g) => g.rows.length > 0);

  const openItem = (n: AppNotification) => {
    void markRead(n.id);
    onClose();
    if (n.href) navigate({ to: n.href as never }).catch(() => {});
  };

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
          className="pointer-events-none absolute right-1.5 top-1.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[var(--destructive,#C5221F)] text-[9px] leading-[15px] text-center font-semibold text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border-0 bg-popover/95 material-panel shadow-[var(--shadow-elevated)] z-50 overflow-hidden origin-top-right animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
          >
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Notifications{unread > 0 ? ` · ${unread} new` : ""}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void markAllRead()}
                  disabled={unread === 0}
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

            <div className="max-h-[26rem] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="h-5 w-5 opacity-50" />
                  You're all caught up.
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.label}>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</div>
                    {g.rows.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => openItem(n)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-accent transition-colors border-b border-border/40 last:border-b-0",
                          !n.readAt && "bg-[var(--primary-container)]/25",
                        )}
                      >
                        <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", n.readAt ? "bg-transparent" : "bg-primary")} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {EVENT_LABEL[n.kind] ?? n.kind}
                          </span>
                          <span className="block text-sm truncate">{n.title}</span>
                          {n.body && <span className="block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {n.actorName ? `${n.actorName} · ` : ""}
                            {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </span>
                      </button>
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
