// Project workflow sequencing: every project gets an ordered chain of steps
// from Quote to Paid. Some steps complete themselves from evidence that already
// exists elsewhere in the app (accepted quote, uploaded PO, signed PVR, issued
// invoice, payment received); the rest are ticked by the team.
import { useMemo } from "react";
import {
  projectStagesStore,
  useProjectStages,
  useQuotes,
  usePurchaseOrders,
  useInvoices,
  usePvrRecords,
  type Project,
  type ProjectStage,
  type ProjectStageStatus,
} from "./mock-data";
import { newId } from "./data-store";
import { logActivity } from "./document-activity";

export interface StageTemplateEntry {
  key: string;
  name: string;
  /** Completed from evidence rather than manually. */
  auto: boolean;
  /** Plain-language explanation of what "done" means for this step. */
  hint: string;
}

/** The default sequence created with every new project. */
export const DEFAULT_STAGE_TEMPLATE: StageTemplateEntry[] = [
  { key: "quote", name: "Quote", auto: true, hint: "A quotation for this project has been accepted by the client." },
  { key: "po", name: "PO", auto: true, hint: "The client's purchase order is on file, or the PO requirement was waived." },
  { key: "kickoff", name: "Kickoff", auto: false, hint: "Team briefed, scope confirmed and the work has started." },
  { key: "execution", name: "Execution", auto: false, hint: "The delivery work itself is complete." },
  { key: "review", name: "Review", auto: false, hint: "Internal quality review passed before handing over." },
  { key: "delivery", name: "Delivery", auto: false, hint: "Deliverables handed over to the client." },
  { key: "pvr", name: "PVR / acceptance", auto: true, hint: "A signed acceptance record (PVR) exists for this project." },
  { key: "invoice", name: "Invoice", auto: true, hint: "At least one invoice has been issued for this project." },
  { key: "paid", name: "Paid", auto: true, hint: "Every invoice on this project is fully settled." },
];

export const stageHint = (key: string) =>
  DEFAULT_STAGE_TEMPLATE.find((s) => s.key === key)?.hint ?? "";

export const STAGE_STATUS_LABEL: Record<ProjectStageStatus, string> = {
  pending: "Not started",
  active: "In progress",
  blocked: "Blocked",
  done: "Done",
  skipped: "Skipped",
};

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates the workflow steps for a project. Idempotent: steps that already
 * exist for the project are left untouched.
 */
export function seedStagesForProject(project: Pick<Project, "id" | "companyId">) {
  const existing = new Set(
    projectStagesStore.items.filter((s) => s.projectId === project.id).map((s) => s.key),
  );
  DEFAULT_STAGE_TEMPLATE.forEach((t, i) => {
    if (existing.has(t.key)) return;
    const stage: ProjectStage = {
      id: newId("pstg"),
      companyId: project.companyId,
      projectId: project.id,
      position: i,
      key: t.key,
      name: t.name,
      status: i === 0 ? "active" : "pending",
      auto: t.auto,
    };
    projectStagesStore.add(stage, { silent: true });
  });
}

/** Seeds every project that has no workflow yet. Returns how many were seeded. */
export function backfillStages(projects: Project[]): number {
  const withStages = new Set(projectStagesStore.items.map((s) => s.projectId));
  const missing = projects.filter((p) => !withStages.has(p.id));
  missing.forEach((p) => seedStagesForProject(p));
  return missing.length;
}

/* ------------------------------------------------------------------ */
/* Evidence-driven auto completion                                     */
/* ------------------------------------------------------------------ */

export interface StageEvidence {
  quoteAccepted: boolean;
  poOnFile: boolean;
  poWaived: boolean;
  pvrSigned: boolean;
  invoiced: boolean;
  fullyPaid: boolean;
}

/** Which auto stages the surrounding data says are complete. */
export function autoDoneKeys(ev: StageEvidence): Set<string> {
  const done = new Set<string>();
  if (ev.quoteAccepted) done.add("quote");
  if (ev.poOnFile || ev.poWaived) done.add("po");
  if (ev.pvrSigned) done.add("pvr");
  if (ev.invoiced) done.add("invoice");
  if (ev.fullyPaid) done.add("paid");
  return done;
}

/**
 * Merges stored steps with live evidence. Nothing is written to the database
 * here — the derived view is what the UI renders, so the workflow is always
 * truthful even if a document changed elsewhere.
 */
export function resolveStages(
  stored: ProjectStage[],
  ev: StageEvidence,
  autoDates: Record<string, string | undefined> = {},
): ProjectStage[] {
  const auto = autoDoneKeys(ev);
  return [...stored]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      if (!s.auto || s.status === "skipped" || !auto.has(s.key)) return s;
      const completedAt = s.completedAt ?? autoDates[s.key];
      if (s.status === "done" && s.completedAt === completedAt) return s;
      return { ...s, status: "done" as ProjectStageStatus, completedAt };
    });
}

/** Whole days between two dates, minimum 0. */
export function stageDurationDays(stage: ProjectStage, today = new Date()): number | undefined {
  if (!stage.startedAt) return undefined;
  const start = new Date(stage.startedAt).getTime();
  const end = stage.completedAt ? new Date(stage.completedAt).getTime() : today.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

/** Elapsed days from the first started step to the last finished one (or today). */
export function workflowElapsedDays(stages: ProjectStage[], today = new Date()): number | undefined {
  const starts = stages.map((s) => s.startedAt).filter(Boolean) as string[];
  if (starts.length === 0) return undefined;
  const first = Math.min(...starts.map((d) => new Date(d).getTime()));
  const allDone = stages.filter((s) => s.status !== "skipped").every((s) => s.status === "done");
  const ends = stages.map((s) => s.completedAt).filter(Boolean) as string[];
  const last = allDone && ends.length > 0
    ? Math.max(...ends.map((d) => new Date(d).getTime()))
    : today.getTime();
  return Math.max(0, Math.round((last - first) / 86_400_000));
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export interface StageProgress {
  /** 0–100, skipped steps excluded from the denominator. */
  pct: number;
  done: number;
  total: number;
  current?: ProjectStage;
  blocked: number;
  /** Steps past their due date and not finished. */
  overdue: number;
}

export function stageProgress(stages: ProjectStage[], today = new Date()): StageProgress {
  const applicable = stages.filter((s) => s.status !== "skipped");
  const done = applicable.filter((s) => s.status === "done").length;
  const total = applicable.length;
  const current =
    applicable.find((s) => s.status === "active") ??
    applicable.find((s) => s.status === "blocked") ??
    applicable.find((s) => s.status === "pending");
  const iso = today.toISOString().slice(0, 10);
  return {
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    done,
    total,
    current,
    blocked: applicable.filter((s) => s.status === "blocked").length,
    overdue: applicable.filter((s) => s.status !== "done" && s.dueDate && s.dueDate < iso).length,
  };
}

/* ------------------------------------------------------------------ */
/* Transitions                                                         */
/* ------------------------------------------------------------------ */

/** Moves one step and pulls the next pending step into "in progress". */
export function setStageStatus(
  stage: ProjectStage,
  status: ProjectStageStatus,
  opts?: { blockedReason?: string; projectName?: string },
) {
  const now = new Date().toISOString();
  const patch: Partial<ProjectStage> = {
    status,
    startedAt:
      status === "pending" ? undefined
      : stage.startedAt ?? ((status === "active" || status === "done") ? now : undefined),
    completedAt: status === "done" ? stage.completedAt ?? now : undefined,
    blockedReason: status === "blocked" ? opts?.blockedReason ?? stage.blockedReason : undefined,
  };
  projectStagesStore.update(stage.id, patch);

  if (status === "done" || status === "skipped") {
    const siblings = projectStagesStore.items
      .filter((s) => s.projectId === stage.projectId && s.id !== stage.id)
      .sort((a, b) => a.position - b.position);
    const next = siblings.find((s) => s.position > stage.position && s.status === "pending");
    if (next && !siblings.some((s) => s.status === "active")) {
      projectStagesStore.update(next.id, { status: "active", startedAt: next.startedAt ?? now }, { silent: true });
    }
  }

  void logActivity({
    docType: "project",
    docId: stage.projectId,
    docNumber: opts?.projectName,
    companyId: stage.companyId,
    action: "stage_changed",
    summary: `${stage.name}: ${STAGE_STATUS_LABEL[stage.status]} → ${STAGE_STATUS_LABEL[status]}`,
    details: { stageKey: stage.key, from: stage.status, to: status, reason: opts?.blockedReason },
  });
}

/**
 * One-click "move forward": finishes the given step (stamping its end date)
 * and starts the following one. Steps that have not started yet are started
 * instead of completed, so a single button drives the whole chain.
 */
export function advanceStage(stage: ProjectStage, opts?: { projectName?: string }) {
  if (stage.status === "pending" || stage.status === "blocked") {
    setStageStatus(stage, "active", { projectName: opts?.projectName });
    return;
  }
  if (stage.status === "done" || stage.status === "skipped") return;
  setStageStatus(stage, "done", { projectName: opts?.projectName });
}

export function updateStage(stage: ProjectStage, patch: Partial<ProjectStage>) {
  projectStagesStore.update(stage.id, patch);
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface ProjectWorkflow {
  stages: ProjectStage[];
  progress: StageProgress;
  evidence: StageEvidence;
}

/** Live workflow (stages + evidence + progress) for every project, keyed by id. */
export function useProjectWorkflows(projects: Project[]): Map<string, ProjectWorkflow> {
  const stages = useProjectStages();
  const quotes = useQuotes();
  const pos = usePurchaseOrders();
  const invoices = useInvoices();
  const pvrs = usePvrRecords();

  return useMemo(() => {
    const byProject = new Map<string, ProjectStage[]>();
    for (const s of stages) {
      if (!byProject.has(s.projectId)) byProject.set(s.projectId, []);
      byProject.get(s.projectId)!.push(s);
    }

    const map = new Map<string, ProjectWorkflow>();
    for (const p of projects) {
      const projQuotes = quotes.filter((q) => q.projectId === p.id);
      const projPos = pos.filter((o) => o.projectId === p.id);
      const projInv = invoices.filter((i) => i.projectId === p.id && i.status !== "cancelled");
      const evidence: StageEvidence = {
        quoteAccepted: projQuotes.some((q) => q.status === "accepted"),
        poOnFile: projPos.some((o) => !!o.documentUrl) || projInv.some((i) => !!i.poId),
        poWaived: projInv.length > 0 && projInv.every((i) => i.poWaived || !!i.poId),
        pvrSigned: pvrs.some((r) => r.projectId === p.id),
        invoiced: projInv.length > 0,
        fullyPaid: projInv.length > 0 && projInv.every((i) => i.paid >= i.amount - 0.5),
      };
      const acceptedQuote = projQuotes.find((q) => q.status === "accepted");
      const firstPo = projPos[0];
      const pvr = pvrs.find((r) => r.projectId === p.id);
      const firstInv = [...projInv].sort((a, b) => a.issueDate.localeCompare(b.issueDate))[0];
      const lastPayment = projInv
        .map((i) => i.paidDate)
        .filter(Boolean)
        .sort()
        .pop();
      const autoDates: Record<string, string | undefined> = {
        quote: acceptedQuote?.updatedAt ?? acceptedQuote?.issueDate,
        po: firstPo?.issueDate ?? firstInv?.issueDate,
        pvr: pvr?.signedDate,
        invoice: firstInv?.issueDate,
        paid: lastPayment,
      };
      const resolved = resolveStages(byProject.get(p.id) ?? [], evidence, autoDates);
      map.set(p.id, { stages: resolved, evidence, progress: stageProgress(resolved) });
    }
    return map;
  }, [projects, stages, quotes, pos, invoices, pvrs]);
}
