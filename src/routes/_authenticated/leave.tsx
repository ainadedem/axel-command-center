import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, X, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import {
  createLeave, deleteLeave, setLeaveStatus, toDbCompany, useAttendanceData, useCompanyMembers,
} from "@/lib/time-attendance";
import {
  eachDay, holidayOn, monthEnd, monthStart, scheduleFor, todayKey, weekdayOf,
  type LeaveRequest,
} from "@/lib/time-calc";

export const Route = createFileRoute("/_authenticated/leave")({ component: LeavePage });

const TONE: Record<LeaveRequest["status"], string> = {
  pending: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted/40 text-muted-foreground",
};

function LeavePage() {
  const { scope, accessibleCompanies } = useCompany();
  const { user } = useAuth();
  const { isAdmin, isGroupAdmin, role } = useEffectiveRole();
  const canManage = isAdmin || isGroupAdmin || role === "manager";

  const companyDbIds = useMemo(() => {
    const locals = scope.id === "company" ? [scope.companyId] : accessibleCompanies.map((c) => c.id);
    return locals.map((id) => toDbCompany(id)).filter((v): v is string => !!v);
  }, [scope, accessibleCompanies]);
  const defaultCompany = companyDbIds[0];

  const year = todayKey().slice(0, 4);
  const data = useAttendanceData(companyDbIds, `${year}-01-01`, `${year}-12-31`);
  const { members } = useCompanyMembers(companyDbIds);
  const nameOf = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members]);

  const [kind, setKind] = useState<LeaveRequest["kind"]>("paid");
  const [start, setStart] = useState(todayKey());
  const [end, setEnd] = useState(todayKey());
  const [halfDay, setHalfDay] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = canManage ? data.leaves : data.leaves.filter((l) => l.employeeId === user?.id);
  const pending = visible.filter((l) => l.status === "pending");
  const others = visible.filter((l) => l.status !== "pending");

  const schedule = scheduleFor(data.schedules, user?.id ?? "", defaultCompany);
  const workingDaysRequested = useMemo(
    () => eachDay(start, end).filter((k) => schedule.workingDays.includes(weekdayOf(k)) && !holidayOn(data.holidays, k)).length,
    [start, end, schedule, data.holidays],
  );

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await data.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  const submit = () => {
    if (!defaultCompany || !user?.id) return;
    if (end < start) { toast.error("End date is before the start date."); return; }
    void run(async () => {
      await createLeave({
        companyId: defaultCompany, employeeId: user.id, kind,
        startDate: start, endDate: end, halfDay, note: note.trim() || null,
      });
      setNote("");
    }, "Leave request sent");
  };

  const upcomingHolidays = [...data.holidays]
    .filter((h) => h.date >= monthStart(todayKey()) && h.date <= `${year}-12-31`)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return (
    <AppShell>
      <PageHeader title="Leave" description="Time off requests, approvals and the Madagascar holiday calendar." />
      <div className="p-5 sm:p-10 lg:p-12 pt-0 space-y-5">
        <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-4">
          <h2 className="t-body font-medium">Request time off</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="t-label">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as LeaveRequest["kind"])}>
                <SelectTrigger className="h-9 t-label"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid leave</SelectItem>
                  <SelectItem value="sick">Sick leave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="t-label">From</Label><Input type="date" className="h-9" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label className="t-label">To</Label><Input type="date" className="h-9" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <label className="flex items-center gap-2 t-label h-9 cursor-pointer">
              <Switch checked={halfDay} onCheckedChange={setHalfDay} /> Half day
            </label>
            <div className="col-span-2 sm:col-span-1">
              <Label className="t-label">Note</Label>
              <Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="t-label text-muted-foreground">
              {workingDaysRequested} working day{workingDaysRequested === 1 ? "" : "s"} · weekends and holidays excluded
            </span>
            <div className="flex-1" />
            <Button size="sm" className="gap-1.5" disabled={busy || !defaultCompany} onClick={submit}>
              <CalendarPlus className="h-3.5 w-3.5" /> Send request
            </Button>
          </div>
        </section>

        <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-3">
          <h2 className="t-body font-medium">Pending {canManage ? "approvals" : "requests"}</h2>
          {pending.length === 0 && <p className="t-body text-muted-foreground py-4">Nothing waiting.</p>}
          <div className="divide-y divide-border/30">
            {pending.map((l) => (
              <LeaveRow key={l.id} leave={l} name={nameOf.get(l.employeeId) ?? "—"} canManage={canManage} meId={user?.id}
                onApprove={() => void run(() => setLeaveStatus(l.id, "approved", user?.id), "Leave approved")}
                onReject={() => void run(() => setLeaveStatus(l.id, "rejected"), "Leave rejected")}
                onDelete={() => void run(() => deleteLeave(l.id), "Request removed")}
                busy={busy} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className="lg:col-span-2 rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-3">
            <h2 className="t-body font-medium">History</h2>
            {others.length === 0 && <p className="t-body text-muted-foreground py-4">No past requests yet.</p>}
            <div className="divide-y divide-border/30">
              {others.sort((a, b) => b.startDate.localeCompare(a.startDate)).map((l) => (
                <LeaveRow key={l.id} leave={l} name={nameOf.get(l.employeeId) ?? "—"} canManage={canManage} meId={user?.id}
                  onDelete={() => void run(() => deleteLeave(l.id), "Request removed")} busy={busy} />
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-3">
            <h2 className="t-body font-medium">Upcoming holidays</h2>
            {upcomingHolidays.length === 0 && (
              <p className="t-label text-muted-foreground">No holidays loaded. An admin can seed them from Time &amp; Attendance settings.</p>
            )}
            <div className="divide-y divide-border/30">
              {upcomingHolidays.map((h) => (
                <div key={h.id} className="py-2 flex items-center gap-3 t-body">
                  <span className="font-tnum text-muted-foreground w-24">{h.date}</span>
                  <span className="truncate">{h.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function LeaveRow({
  leave, name, canManage, meId, onApprove, onReject, onDelete, busy,
}: {
  leave: LeaveRequest;
  name: string;
  canManage: boolean;
  meId?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  const mine = leave.employeeId === meId;
  return (
    <div className="py-2.5 flex items-center gap-3 t-body">
      <div className="min-w-0 flex-1">
        <div className="truncate">{name}{mine ? " (you)" : ""}</div>
        <div className="t-label text-muted-foreground font-tnum">
          {leave.startDate} → {leave.endDate}{leave.halfDay ? " · half day" : ""} · {leave.kind}
          {leave.note ? ` · ${leave.note}` : ""}
        </div>
      </div>
      <span className={cn("t-label px-2.5 py-1 rounded-full shrink-0", TONE[leave.status])}>{leave.status}</span>
      {canManage && leave.status === "pending" && (
        <>
          <button disabled={busy} onClick={onApprove} title="Approve"
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-success/10 text-muted-foreground hover:text-success"><Check className="h-4 w-4" /></button>
          <button disabled={busy} onClick={onReject} title="Reject"
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
        </>
      )}
      {(canManage || (mine && leave.status === "pending")) && (
        <button disabled={busy} onClick={onDelete} title="Delete"
          className="h-8 w-8 grid place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}
