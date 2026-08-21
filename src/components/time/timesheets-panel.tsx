import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, Send, RotateCcw, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addDays, fmtDuration, fmtHours, monthEnd, monthStart, scheduleFor, summarizeDays, todayKey,
  totalsOf, weekStart, type Holiday, type LeaveRequest, type Schedule, type TimeEntry,
} from "@/lib/time-calc";
import {
  approveEntries, approveTimesheet, reopenTimesheet, saveTimesheet,
  type Member, type Timesheet,
} from "@/lib/time-attendance";

type PeriodKind = "week" | "month";

function periodRange(kind: PeriodKind, anchor: string) {
  return kind === "week"
    ? { from: weekStart(anchor), to: addDays(weekStart(anchor), 6) }
    : { from: monthStart(anchor), to: monthEnd(anchor) };
}

export function TimesheetsPanel({
  members, entries, schedules, holidays, leaves, timesheets,
  meId, canManage, onChanged,
}: {
  members: Member[];
  entries: TimeEntry[];
  schedules: Schedule[];
  holidays: Holiday[];
  leaves: LeaveRequest[];
  timesheets: Timesheet[];
  meId?: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<PeriodKind>("week");
  const [anchor, setAnchor] = useState(todayKey());
  const [employeeId, setEmployeeId] = useState<string>(meId ?? members[0]?.userId ?? "");
  const [busy, setBusy] = useState(false);

  const visible = canManage ? members : members.filter((m) => m.userId === meId);
  const employee = visible.find((m) => m.userId === employeeId) ?? visible[0];
  const { from, to } = periodRange(kind, anchor);

  const schedule = useMemo(
    () => scheduleFor(schedules, employee?.userId ?? "", employee?.companyId),
    [schedules, employee],
  );

  const days = useMemo(() => {
    if (!employee) return [];
    return summarizeDays({ employeeId: employee.userId, from, to, entries, schedule, holidays, leaves });
  }, [employee, from, to, entries, schedule, holidays, leaves]);

  const totals = useMemo(() => totalsOf(days), [days]);
  const sheet = timesheets.find(
    (t) => t.employeeId === employee?.userId && t.periodStart === from && t.periodEnd === to,
  );
  const locked = sheet?.status === "approved";

  const step = (dir: number) =>
    setAnchor(kind === "week" ? addDays(anchor, dir * 7) : `${monthStart(addDays(monthStart(anchor), dir > 0 ? 32 : -1)).slice(0, 7)}-01`);

  const persist = async (status: Timesheet["status"]) => {
    if (!employee) return "";
    return saveTimesheet({
      companyId: employee.companyId,
      employeeId: employee.userId,
      periodStart: from,
      periodEnd: to,
      regularMinutes: totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes,
      breakMinutes: totals.breakMinutes,
      leaveMinutes: totals.leaveMinutes,
      unpaidLeaveMinutes: totals.unpaidLeaveMinutes,
      status,
      note: null,
    });
  };

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  const submit = () => run(async () => { await persist("submitted"); }, "Timesheet submitted for approval");
  const saveDraft = () => run(async () => { await persist("draft"); }, "Timesheet saved");
  const approve = () => run(async () => {
    const id = sheet?.id ?? (await persist("submitted"));
    await approveTimesheet(id, meId ?? "");
    await approveEntries(days.flatMap((d) => d.entries).filter((e) => e.clockOut));
  }, "Timesheet approved and locked");
  const reopen = () => run(async () => { if (sheet) await reopenTimesheet(sheet.id); }, "Timesheet reopened");

  return (
    <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium">Timesheet</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-muted/50" aria-label="Previous period"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs font-tnum text-muted-foreground px-1">{from} → {to}</span>
          <button onClick={() => step(1)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-muted/50" aria-label="Next period"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="inline-flex rounded-full bg-muted/40 p-0.5 text-xs">
          {(["week", "month"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={cn("px-3 py-1 rounded-full capitalize transition", kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {k}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {canManage && (
          <Select value={employee?.userId ?? ""} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-9 w-56 rounded-full text-xs"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              {visible.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Regular" value={fmtDuration(totals.regularMinutes)} />
        <Stat label="Overtime" value={fmtDuration(totals.overtimeMinutes)} tone="text-warning" />
        <Stat label="Breaks" value={fmtDuration(totals.breakMinutes)} />
        <Stat label="Paid leave" value={fmtDuration(totals.leaveMinutes)} />
        <Stat label="Unpaid leave" value={fmtDuration(totals.unpaidLeaveMinutes)} tone="text-destructive" />
      </div>

      {totals.missingClockOuts > 0 && (
        <div className="flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          {totals.missingClockOuts} day{totals.missingClockOuts > 1 ? "s" : ""} with a missing clock-out — fix before submitting.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
              <th className="py-2 font-normal">Day</th>
              <th className="py-2 font-normal">Entries</th>
              <th className="py-2 font-normal text-right">Worked</th>
              <th className="py-2 font-normal text-right">Regular</th>
              <th className="py-2 font-normal text-right">Overtime</th>
              <th className="py-2 font-normal">Notes</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.key} className={cn("border-t border-border/30", !d.isWorkingDay && "text-muted-foreground")}>
                <td className="py-1.5 font-tnum">{d.key.slice(5)}</td>
                <td className="py-1.5 text-xs">{d.entries.length}</td>
                <td className="py-1.5 text-right font-tnum">{fmtHours(d.workedMinutes)}</td>
                <td className="py-1.5 text-right font-tnum">{fmtHours(d.regularMinutes)}</td>
                <td className="py-1.5 text-right font-tnum text-warning">{d.overtimeMinutes ? fmtHours(d.overtimeMinutes) : "—"}</td>
                <td className="py-1.5 text-xs text-muted-foreground">
                  {[d.holiday?.name, d.leave ? `${d.leave.kind} leave` : null,
                    d.lateMinutes ? `${d.lateMinutes} min late` : null,
                    d.missingClockOut ? "missing clock-out" : null]
                    .filter(Boolean).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-[11px] px-2.5 py-1 rounded-full",
          locked ? "bg-success/10 text-success" : sheet?.status === "submitted" ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground")}>
          {locked && <Lock className="h-3 w-3 inline mr-1" />}
          {sheet?.status ?? "not saved"}
        </span>
        <div className="flex-1" />
        {!locked && <Button size="sm" variant="outline" disabled={busy} onClick={saveDraft}>Save draft</Button>}
        {!locked && (
          <Button size="sm" disabled={busy} onClick={submit} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Submit
          </Button>
        )}
        {canManage && !locked && (
          <Button size="sm" disabled={busy} onClick={approve} className="gap-1.5">
            <Check className="h-3.5 w-3.5" /> Approve
          </Button>
        )}
        {canManage && locked && (
          <Button size="sm" variant="outline" disabled={busy} onClick={reopen} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reopen
          </Button>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-surface/60 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-tnum", tone)}>{value}</div>
    </div>
  );
}
