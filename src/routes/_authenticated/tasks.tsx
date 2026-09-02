/**
 * Tasks — the team's shared to-do list.
 *
 * A task is a plain piece of work: a title, an owner, a due date and, when it
 * helps, the project / client / quotation / invoice it belongs to. Everything
 * saves straight to the backend so tasks are visible to the whole company.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FolderKanban, Pencil, Plus, Trash2, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ProjectsStylePageShell } from "@/components/projects-style-page-shell";
import { DetailPanel, DetailSection, DetailField } from "@/components/master-detail";
import {
  ListTableShell, ListTable, ListHeadRow, ListTh, ListTd,
  ListActionsTh, ListRowActions, RowAction,
} from "@/components/list-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuoteAssigneePicker } from "@/components/quote-assignee-picker";
import { EmptyState } from "@/components/crud-toolbar";
import { useSingleFlightSubmit } from "@/components/form-ux";

import { inScope, useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth-context";
import { useCreateAction } from "@/lib/create-action";
import { tasksStore, useTasks, useProjects, useClients, useQuotes, useInvoices, type Task } from "@/lib/mock-data";
import { clientLabel } from "@/lib/client-name";
import {
  TASK_STATUSES, TASK_PRIORITIES, TASK_STATUS_LABEL, TASK_STATUS_TONE,
  TASK_PRIORITY_LABEL, TASK_PRIORITY_TONE,
  createTask, setTaskStatus, sortTasks, taskKpis, isOverdue, todayIso,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
  head: () => ({
    meta: [
      { title: "Tasks | Axel" },
      { name: "description", content: "Shared team to-do list: assign work, set due dates and link each task to its project, client, quotation or invoice." },
      { property: "og:title", content: "Tasks | Axel" },
      { property: "og:description", content: "Assign work, set due dates and link tasks to projects, clients and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TasksPage() {
  return (
    <AppShell>
      <PageHeader title="Tasks" description="Track work items across projects and teams." />
      <TasksBody />
    </AppShell>
  );
}

type Filter = "all" | "open" | "mine" | "overdue" | "done";

function TasksBody() {
  const { scope, scopedCompanies } = useCompany();
  const { user } = useAuth();
  const allTasks = useTasks();
  const projects = useProjects();
  const clients = useClients();
  const quotes = useQuotes();
  const invoices = useInvoices();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const openCreate = () => { setEditing(null); setOpen(true); };
  useCreateAction(openCreate);

  const scoped = useMemo(() => inScope(allTasks, scope), [allTasks, scope]);
  const kpis = useMemo(() => taskKpis(scoped, user?.id), [scoped, user?.id]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayIso();
    return sortTasks(
      scoped.filter((t) => {
        if (filter === "open" && t.status === "done") return false;
        if (filter === "done" && t.status !== "done") return false;
        if (filter === "overdue" && !isOverdue(t, today)) return false;
        if (filter === "mine" && !(user && (t.assignedTo.includes(user.id) || t.createdBy === user.id))) return false;
        if (!q) return true;
        return `${t.title} ${t.notes ?? ""}`.toLowerCase().includes(q);
      }),
    );
  }, [scoped, filter, search, user]);

  const selected = rows.find((t) => t.id === selectedId) ?? scoped.find((t) => t.id === selectedId) ?? null;

  const projectName = (id?: string) => projects.find((p) => p.id === id)?.name;
  const clientName = (id?: string) => {
    const c = clients.find((x) => x.id === id);
    return c ? clientLabel(c) : undefined;
  };
  const quoteNumber = (id?: string) => quotes.find((q) => q.id === id)?.number;
  const invoiceNumber = (id?: string) => invoices.find((i) => i.id === id)?.number;

  const remove = (t: Task) => {
    if (!confirm(`Delete “${t.title}”?`)) return;
    tasksStore.remove(t.id);
    if (selectedId === t.id) setSelectedId(null);
  };

  const filters: { key: Filter; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "mine", label: "Mine" },
    { key: "overdue", label: "Overdue" },
    { key: "done", label: "Done" },
    { key: "all", label: "All" },
  ];

  return (
    <>
      <ProjectsStylePageShell
        toolbar={
          <div className="flex items-center gap-2 flex-wrap w-full">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 w-56"
              aria-label="Search tasks"
            />
            <div className="flex items-center gap-1 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs border transition press-scale",
                    filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground ml-auto">{rows.length} tasks</span>
            <Button size="sm" className="h-8" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New task
            </Button>
          </div>
        }
        kpis={
          <>
            <KpiCard label="Open" value={kpis.open} />
            <KpiCard label="Due this week" value={kpis.dueThisWeek} />
            <KpiCard label="Overdue" value={kpis.overdue} tone={kpis.overdue > 0 ? "danger" : "default"} />
            <KpiCard label="Assigned to me" value={kpis.mine} />
            <KpiCard label="Done this month" value={kpis.doneThisMonth} />
          </>
        }
        detail={
          selected ? (
            <DetailPanel
              title={selected.title}
              subtitle={projectName(selected.projectId) ?? clientName(selected.clientId)}
              eyebrow={TASK_STATUS_LABEL[selected.status]}
              onClose={() => setSelectedId(null)}
              actions={
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(selected); setOpen(true); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  {selected.status !== "done" && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => setTaskStatus(selected, "done")}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                    </Button>
                  )}
                </div>
              }
            >
              <DetailSection title="Task">
                <DetailField label="Status" value={TASK_STATUS_LABEL[selected.status]} />
                <DetailField label="Priority" value={TASK_PRIORITY_LABEL[selected.priority]} />
                <DetailField label="Due" value={selected.dueDate ?? "No due date"} mono />
                <DetailField label="Assignees" value={selected.assignedTo.length ? `${selected.assignedTo.length} person(s)` : "Nobody"} />
              </DetailSection>
              <DetailSection title="Linked to">
                <DetailField label="Project" value={projectName(selected.projectId)} />
                <DetailField label="Client" value={clientName(selected.clientId)} />
                <DetailField label="Quotation" value={quoteNumber(selected.quoteId)} />
                <DetailField label="Invoice" value={invoiceNumber(selected.invoiceId)} />
              </DetailSection>
              {selected.notes && (
                <DetailSection title="Notes">
                  <p className="text-xs whitespace-pre-wrap">{selected.notes}</p>
                </DetailSection>
              )}
            </DetailPanel>
          ) : null
        }
      >
        {rows.length === 0 ? (
          <EmptyState label="tasks" onCreate={openCreate} />
        ) : (
          <ListTableShell scrollX>
            <ListTable style={{ minWidth: 860 }}>
              <thead>
                <ListHeadRow>
                  <ListTh width="34%">Task</ListTh>
                  <ListTh width="12%">Status</ListTh>
                  <ListTh width="10%">Priority</ListTh>
                  <ListTh width="12%">Due</ListTh>
                  <ListTh width="16%">Project</ListTh>
                  <ListTh width="12%">Client</ListTh>
                  <ListActionsTh width="72px" />
                </ListHeadRow>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "border-b border-border/40 last:border-0 cursor-pointer hover:bg-surface-elevated/50 transition",
                      selectedId === t.id && "bg-surface-elevated/70",
                    )}
                  >
                    <ListTd title={t.title}>
                      <span className={cn(t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                    </ListTd>
                    <ListTd>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Select value={t.status} onValueChange={(v) => setTaskStatus(t, v as Task["status"])}>
                          <SelectTrigger className={cn("h-6 px-2 text-[11px] border-0 rounded", TASK_STATUS_TONE[t.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </span>
                    </ListTd>
                    <ListTd>
                      <span className={cn("px-2 py-0.5 rounded text-[11px]", TASK_PRIORITY_TONE[t.priority])}>
                        {TASK_PRIORITY_LABEL[t.priority]}
                      </span>
                    </ListTd>
                    <ListTd>
                      <span className={cn("font-tnum text-xs", isOverdue(t) && "text-destructive font-medium")}>
                        {t.dueDate ?? "—"}
                      </span>
                    </ListTd>
                    <ListTd title={projectName(t.projectId)}>
                      {t.projectId ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <FolderKanban className="h-3 w-3 text-muted-foreground" />
                          {projectName(t.projectId) ?? "—"}
                        </span>
                      ) : "—"}
                    </ListTd>
                    <ListTd title={clientName(t.clientId)}>{clientName(t.clientId) ?? "—"}</ListTd>
                    <ListRowActions>
                      <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(t); setOpen(true); }} />
                      <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => remove(t)} />
                    </ListRowActions>
                  </tr>
                ))}
              </tbody>
            </ListTable>
          </ListTableShell>
        )}
      </ProjectsStylePageShell>

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        companies={scopedCompanies.map((c) => ({ id: c.id, name: c.name }))}
        defaultCompanyId={scope.id === "company" ? scope.companyId : scopedCompanies[0]?.id}
        createdBy={user?.id}
        onSaved={(id) => setSelectedId(id)}
      />
    </>
  );
}

function TaskDialog({
  open, onOpenChange, editing, companies, defaultCompanyId, createdBy, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Task | null;
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  createdBy?: string;
  onSaved?: (id: string) => void;
}) {
  const projects = useProjects();
  const clients = useClients();
  const quotes = useQuotes();
  const invoices = useInvoices();

  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [clientId, setClientId] = useState("");
  const [quoteId, setQuoteId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setCompanyId(editing.companyId); setTitle(editing.title); setNotes(editing.notes ?? "");
      setStatus(editing.status); setPriority(editing.priority); setDueDate(editing.dueDate ?? "");
      setAssignedTo(editing.assignedTo ?? []);
      setProjectId(editing.projectId ?? ""); setClientId(editing.clientId ?? "");
      setQuoteId(editing.quoteId ?? ""); setInvoiceId(editing.invoiceId ?? "");
    } else {
      setCompanyId(defaultCompanyId ?? companies[0]?.id ?? "");
      setTitle(""); setNotes(""); setStatus("todo"); setPriority("normal"); setDueDate("");
      setAssignedTo([]); setProjectId(""); setClientId(""); setQuoteId(""); setInvoiceId("");
    }
  }, [open, editing, defaultCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const NONE = "__none__";
  const forCompany = <T extends { companyId: string }>(list: T[]) => list.filter((x) => x.companyId === companyId);

  const { isSubmitting, run: handleSubmit } = useSingleFlightSubmit(async () => {
    if (!companyId) { setError("Pick a company for this task."); return; }
    if (!title.trim()) { setError("Give the task a title."); return; }
    const patch = {
      companyId, title: title.trim(), notes: notes.trim() || undefined, status, priority,
      dueDate: dueDate || undefined, assignedTo,
      projectId: projectId || undefined, clientId: clientId || undefined,
      quoteId: quoteId || undefined, invoiceId: invoiceId || undefined,
    };
    if (editing) {
      tasksStore.update(editing.id, patch);
      onSaved?.(editing.id);
    } else {
      const created = createTask({ ...patch, createdBy });
      onSaved?.(created.id);
    }
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {error && <div className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</div>}

          <div>
            <Label>Task</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chase the signed PO from the client" autoFocus />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Task["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{TASK_PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Assigned to</Label>
            <QuoteAssigneePicker companyId={companyId} value={assignedTo} onChange={setAssignedTo} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>Project</Label>
              <Select value={projectId || NONE} onValueChange={(v) => setProjectId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {forCompany(projects).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId || NONE} onValueChange={(v) => setClientId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {forCompany(clients).map((c) => <SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quotation</Label>
              <Select value={quoteId || NONE} onValueChange={(v) => setQuoteId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={NONE}>None</SelectItem>
                  {forCompany(quotes).map((q) => <SelectItem key={q.id} value={q.id}>{q.number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice</Label>
              <Select value={invoiceId || NONE} onValueChange={(v) => setInvoiceId(v === NONE ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={NONE}>None</SelectItem>
                  {forCompany(invoices).map((i) => <SelectItem key={i.id} value={i.id}>{i.number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anything the owner needs to know." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
