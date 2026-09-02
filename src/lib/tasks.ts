/**
 * Team task list.
 *
 * Tasks are plain work items: a title, who owns it, when it is due and, when
 * useful, the project / client / document it belongs to. Everything here is a
 * pure helper — writes go through `tasksStore`.
 */
import { tasksStore, type Task, type TaskStatus, type TaskPriority } from "./mock-data";
import { newId } from "./data-store";

export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "blocked", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  todo: "bg-surface-elevated text-muted-foreground",
  doing: "bg-primary/12 text-primary",
  blocked: "bg-destructive/12 text-destructive",
  done: "bg-emerald-500/12 text-emerald-600",
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-surface-elevated text-muted-foreground",
  normal: "bg-surface-elevated text-foreground",
  high: "bg-warning/12 text-warning",
  urgent: "bg-destructive/12 text-destructive",
};

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const isOpen = (t: Task) => t.status !== "done";

export const isOverdue = (t: Task, today = todayIso()) =>
  isOpen(t) && !!t.dueDate && t.dueDate < today;

/** ISO date of the Sunday ending the current week (used for "due this week"). */
export function endOfWeekIso(from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() + ((7 - dow) % 7));
  return d.toISOString().slice(0, 10);
}

export const isDueThisWeek = (t: Task, today = todayIso()) =>
  isOpen(t) && !!t.dueDate && t.dueDate >= today && t.dueDate <= endOfWeekIso();

/** Open first, then urgency, then due date, then title. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    if (a.dueDate !== b.dueDate) return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    return a.title.localeCompare(b.title);
  });
}

export interface TaskKpis {
  open: number;
  dueThisWeek: number;
  overdue: number;
  mine: number;
  doneThisMonth: number;
}

export function taskKpis(tasks: Task[], userId?: string): TaskKpis {
  const today = todayIso();
  const month = today.slice(0, 7);
  return {
    open: tasks.filter(isOpen).length,
    dueThisWeek: tasks.filter((t) => isDueThisWeek(t, today)).length,
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
    mine: userId
      ? tasks.filter((t) => isOpen(t) && (t.assignedTo.includes(userId) || t.createdBy === userId)).length
      : 0,
    doneThisMonth: tasks.filter(
      (t) => t.status === "done" && (t.completedAt ?? t.updatedAt ?? "").slice(0, 7) === month,
    ).length,
  };
}

/** Tasks assigned to, or created by, one person. */
export const myTasks = (tasks: Task[], userId?: string) =>
  userId ? tasks.filter((t) => t.assignedTo.includes(userId) || t.createdBy === userId) : [];

export interface NewTaskInput {
  companyId: string;
  title: string;
  notes?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedTo?: string[];
  projectId?: string;
  clientId?: string;
  quoteId?: string;
  invoiceId?: string;
  paymentRequestId?: string;
  createdBy?: string;
}

/** Creates a task and returns the local record. */
export function createTask(input: NewTaskInput): Task {
  const task: Task = {
    id: newId("task"),
    companyId: input.companyId,
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    status: input.status ?? "todo",
    priority: input.priority ?? "normal",
    dueDate: input.dueDate || undefined,
    assignedTo: (input.assignedTo ?? []).slice(0, 3),
    projectId: input.projectId || undefined,
    clientId: input.clientId || undefined,
    quoteId: input.quoteId || undefined,
    invoiceId: input.invoiceId || undefined,
    paymentRequestId: input.paymentRequestId || undefined,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  };
  tasksStore.add(task);
  return task;
}

/** Moves a task to a new status, stamping completion. */
export function setTaskStatus(task: Task, status: TaskStatus) {
  tasksStore.update(task.id, {
    status,
    completedAt: status === "done" ? task.completedAt ?? new Date().toISOString() : undefined,
  });
}
