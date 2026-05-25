import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, MessageSquare, Trash2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { listAxelThreads, createAxelThread, deleteAxelThread } from "@/lib/axel.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/axel")({
  component: AxelLayout,
});

function AxelLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listAxelThreads);
  const create = useServerFn(createAxelThread);
  const del = useServerFn(deleteAxelThread);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const activeId = pathname.split("/axel/")[1];

  const { data: threads = [] } = useQuery({
    queryKey: ["axel-threads"],
    queryFn: () => list(),
  });

  const onNew = async () => {
    const t = await create({ data: { title: "New conversation" } });
    await qc.invalidateQueries({ queryKey: ["axel-threads"] });
    navigate({ to: "/axel/$threadId", params: { threadId: t.id } });
  };

  const onDelete = async (id: string) => {
    await del({ data: { threadId: id } });
    await qc.invalidateQueries({ queryKey: ["axel-threads"] });
    if (activeId === id) navigate({ to: "/axel" });
  };

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="w-72 shrink-0 border-r border-border bg-surface/40 flex flex-col">
          <div className="p-3 border-b border-border">
            <button
              onClick={onNew}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> New conversation
            </button>
          </div>
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Axel AI · CFO Analyst
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            {threads.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                No conversations yet.
              </div>
            )}
            {threads.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md text-sm transition",
                  activeId === t.id ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <Link
                  to="/axel/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}
