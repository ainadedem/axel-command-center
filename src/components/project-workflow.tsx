import { useState } from "react";
import { ArrowRight, Check, CircleDashed, Loader2, MinusCircle, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STAGE_STATUS_LABEL, advanceStage, setStageStatus, stageDurationDays, stageHint,
  updateStage, workflowElapsedDays,
  type ProjectWorkflow,
} from "@/lib/project-stages";
import type { ProjectStage, ProjectStageStatus } from "@/lib/mock-data";

const STATUS_ICON: Record<ProjectStageStatus, typeof Check> = {
  pending: CircleDashed,
  active: Loader2,
  blocked: OctagonAlert,
  done: Check,
  skipped: MinusCircle,
};

const STATUS_TONE: Record<ProjectStageStatus, string> = {
  pending: "text-muted-foreground/60",
  active: "text-primary",
  blocked: "text-destructive",
  done: "text-success",
  skipped: "text-muted-foreground/40",
};

const ORDER: ProjectStageStatus[] = ["pending", "active", "blocked", "done", "skipped"];

/** Slim progress bar used in list rows and detail headers. */
export function StageProgressBar({
  pct, done, total, className, showLabel = true,
}: { pct: number; done: number; total: number; className?: string; showLabel?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <div className="h-1.5 flex-1 min-w-[48px] rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
            pct === 100 ? "bg-success" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[0.6875rem] tabular-nums text-muted-foreground shrink-0">
          {total > 0 ? `${done}/${total}` : "—"}
        </span>
      )}
    </div>
  );
}

/** Full step-by-step workflow for one project, with manual controls. */
export function ProjectWorkflowPanel({
  workflow, projectName,
}: { workflow: ProjectWorkflow; projectName: string }) {
  const { stages, progress } = workflow;
  const elapsed = workflowElapsedDays(stages);
  if (stages.length === 0) {
    return <p className="t-label text-muted-foreground">No workflow yet for this project.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StageProgressBar pct={progress.pct} done={progress.done} total={progress.total} className="flex-1" />
        <span className="t-label font-medium tabular-nums">{progress.pct}%</span>
      </div>
      {progress.current && (
        <p className="t-label text-muted-foreground">
          Next up: <span className="font-medium text-foreground">{progress.current.name}</span> — {stageHint(progress.current.key)}
        </p>
      )}
      {elapsed !== undefined && (
        <p className="text-[0.6875rem] text-muted-foreground">
          {elapsed} day{elapsed === 1 ? "" : "s"} since the first step started.
        </p>
      )}
      <ol className="space-y-1">
        {stages.map((s) => (
          <StageRow key={s.id} stage={s} projectName={projectName} />
        ))}
      </ol>
    </div>
  );
}

function DateCell({
  label, value, onChange,
}: { label: string; value?: string; onChange: (v?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const iso = value ? value.slice(0, 10) : "";
  if (editing) {
    return (
      <Input
        type="date"
        autoFocus
        defaultValue={iso}
        className="h-6 w-[8.5rem] text-[0.75rem]"
        onBlur={(e) => {
          onChange(e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      title={`${label} date`}
      className="shrink-0 rounded px-1 text-[0.6875rem] text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
      onClick={() => setEditing(true)}
    >
      {iso || label}
    </button>
  );
}

function StageRow({ stage, projectName }: { stage: ProjectStage; projectName: string }) {
  const Icon = STATUS_ICON[stage.status];
  const locked = !!stage.auto && stage.status === "done";
  const days = stageDurationDays(stage);

  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-elevated/40 transition-colors">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_TONE[stage.status], stage.status === "active" && "animate-spin [animation-duration:2.4s]")} />
      <span className={cn("text-[0.8125rem] truncate", stage.status === "done" && "text-muted-foreground")} title={stageHint(stage.key)}>
        {stage.name}
      </span>
      {stage.auto && (
        <span className="text-[0.625rem] uppercase tracking-wide text-muted-foreground/70 shrink-0">auto</span>
      )}
      <span className="flex-1" />
      {days !== undefined && (
        <span className="shrink-0 text-[0.625rem] tabular-nums text-muted-foreground/70">{days}d</span>
      )}
      <DateCell label="start" value={stage.startedAt} onChange={(v) => updateStage(stage, { startedAt: v })} />
      <span className="text-muted-foreground/40 text-[0.625rem]">→</span>
      <DateCell label="end" value={stage.completedAt} onChange={(v) => updateStage(stage, { completedAt: v })} />
      <DateCell label="due" value={stage.dueDate} onChange={(v) => updateStage(stage, { dueDate: v ? v.slice(0, 10) : undefined })} />
      {stage.status !== "done" && stage.status !== "skipped" && (
        <Button
          size="sm"
          variant="secondary"
          className="h-6 gap-1 px-2 text-[0.6875rem] shrink-0"
          disabled={locked}
          onClick={() => advanceStage(stage, { projectName })}
        >
          {stage.status === "pending" || stage.status === "blocked" ? "Start" : "Advance"}
          <ArrowRight className="h-3 w-3" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[0.6875rem]" disabled={locked}>
            {STAGE_STATUS_LABEL[stage.status]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ORDER.map((st) => (
            <DropdownMenuItem
              key={st}
              onClick={() => {
                if (st === stage.status) return;
                const reason = st === "blocked" ? window.prompt("What is blocking this step?") ?? undefined : undefined;
                setStageStatus(stage, st, { blockedReason: reason, projectName });
              }}
            >
              {STAGE_STATUS_LABEL[st]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
