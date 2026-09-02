import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Plus, Trash2, Wand2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { exportCsvRows } from "@/lib/export-csv";
import {
  dayKey, entryMinutes, fmtHours, hhmm, scheduleFor, summarizeDays, todayKey, totalsOf,
  type Holiday, type LeaveRequest, type Schedule, type TimeEntry,
} from "@/lib/time-calc";
import {
  deleteHoliday, deleteSchedule, saveHoliday, saveSchedule, seedHolidays,
  useEntryAudit, type Member,
} from "@/lib/time-attendance";
import { setKioskPin, clearKioskPin } from "@/lib/kiosk.functions";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Downloads rows as an Excel-readable workbook (HTML table, .xls). */
function exportExcel(filename: string, headers: string[], rows: string[][]) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html =
    `<html><head><meta charset="utf-8"/></head><body><table border="1">` +
    `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>` +
    rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") +
    `</table></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Reports ───────────────────────────────────────────────────────── */

export function ReportsPanel({
  members, entries, schedules, holidays, leaves, projects, companyDbIds,
}: {
  members: Member[];
  entries: TimeEntry[];
  schedules: Schedule[];
  holidays: Holiday[];
  leaves: LeaveRequest[];
  projects: { id: string; name: string }[];
  companyDbIds: string[];
}) {
  const [employeeId, setEmployeeId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [from, setFrom] = useState(`${todayKey().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayKey());
  const audit = useEntryAudit(companyDbIds, true);
  const nameOf = useMemo(() => new Map(members.map((m) => [m.userId, m.name])), [members]);
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const filtered = useMemo(
    () => entries.filter((e) => {
      const k = dayKey(e.clockIn);
      if (k < from || k > to) return false;
      if (employeeId !== "all" && e.employeeId !== employeeId) return false;
      if (projectId !== "all" && e.projectId !== projectId) return false;
      return true;
    }).sort((a, b) => b.clockIn.localeCompare(a.clockIn)),
    [entries, from, to, employeeId, projectId],
  );

  const perEmployee = useMemo(() => {
    const ids = employeeId === "all" ? members.map((m) => m.userId) : [employeeId];
    return ids.map((id) => {
      const member = members.find((m) => m.userId === id);
      const schedule = scheduleFor(schedules, id, member?.companyId);
      const days = summarizeDays({ employeeId: id, from, to, entries: filtered, schedule, holidays, leaves });
      return { id, name: nameOf.get(id) ?? "—", totals: totalsOf(days) };
    }).filter((r) => r.totals.workedMinutes > 0 || employeeId !== "all");
  }, [employeeId, members, schedules, from, to, filtered, holidays, leaves, nameOf]);

  const headers = ["Date", "Employee", "Clock in", "Clock out", "Hours", "Project", "Activity", "Billable", "Method", "Status", "GPS"];
  const rows = filtered.map((e) => [
    dayKey(e.clockIn),
    nameOf.get(e.employeeId) ?? e.employeeId,
    hhmm(e.clockIn),
    e.clockOut ? hhmm(e.clockOut) : "",
    fmtHours(entryMinutes(e)),
    e.projectId ? projectName.get(e.projectId) ?? "" : "",
    e.activity ?? "",
    e.billable ? "yes" : "no",
    e.method,
    e.status,
    e.gpsLat != null ? `${e.gpsLat}, ${e.gpsLng}` : "",
  ]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">From</Label><Input type="date" className="h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">To</Label><Input type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <Label className="text-xs">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-9 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 w-52 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCsvRows(`axel-attendance-${from}_${to}.csv`, headers, rows)}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportExcel(`axel-attendance-${from}_${to}.xls`, headers, rows)}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {perEmployee.map((r) => (
            <div key={r.id} className="rounded-2xl bg-surface/60 px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0 truncate text-sm">{r.name}</div>
              <div className="text-xs text-muted-foreground font-tnum">
                {fmtHours(r.totals.regularMinutes)}h reg · <span className="text-warning">{fmtHours(r.totals.overtimeMinutes)}h OT</span>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="sheet w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left">
                {headers.map((h) => <th key={h} className="py-2 font-normal whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={headers.length} className="py-8 text-center text-muted-foreground text-sm">No entries in this range.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={filtered[i].id} className="border-t border-border/30">
                  {r.map((c, j) => <td key={j} className={cn("py-1.5 pr-3 whitespace-nowrap", j === 4 && "font-tnum text-right")}>{c || "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> Audit trail</h2>
        <p className="text-xs text-muted-foreground">Every punch and edit is recorded with its author, method and timestamp.</p>
        <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
          {audit.length === 0 && <p className="py-6 text-sm text-muted-foreground text-center">No activity recorded yet.</p>}
          {audit.map((a) => (
            <div key={a.id} className="py-2 text-xs flex items-center gap-3">
              <span className="font-tnum text-muted-foreground w-32 shrink-0">{a.createdAt.slice(0, 16).replace("T", " ")}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted/40 shrink-0">{a.action}</span>
              <span className="truncate">{a.actorName ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── Settings: schedules, holidays, kiosk PINs ─────────────────────── */

export function AttendanceSettings({
  companyDbId, members, schedules, holidays, onChanged,
}: {
  companyDbId?: string;
  members: Member[];
  schedules: Schedule[];
  holidays: Holiday[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [holName, setHolName] = useState("");
  const [holDate, setHolDate] = useState(todayKey());
  const [pinEmployee, setPinEmployee] = useState("");
  const [pin, setPin] = useState("");

  const [form, setForm] = useState({
    id: "" as string,
    employeeId: "all",
    name: "Standard shift",
    startTime: "08:00",
    endTime: "17:00",
    workingDays: [1, 2, 3, 4, 5] as number[],
    breakMinutes: 60,
    graceMinutes: 10,
  });

  const run = async (fn: () => Promise<void>, ok: string) => {
    if (!companyDbId) { toast.error("Pick a single company first."); return; }
    setBusy(true);
    try { await fn(); toast.success(ok); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, workingDays: f.workingDays.includes(d) ? f.workingDays.filter((x) => x !== d) : [...f.workingDays, d].sort() }));

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-4">
        <h2 className="text-sm font-medium">Work schedules</h2>
        <div className="divide-y divide-border/30">
          {schedules.length === 0 && <p className="py-4 text-sm text-muted-foreground">No schedule yet — the default 08:00–17:00, Mon–Fri applies.</p>}
          {schedules.map((s) => (
            <div key={s.id} className="py-2 flex items-center gap-3 text-sm">
              <div className="flex-1 min-w-0 truncate">
                {s.name ?? "Shift"} · {s.employeeId ? members.find((m) => m.userId === s.employeeId)?.name ?? "Employee" : "Everyone"}
              </div>
              <div className="text-xs text-muted-foreground font-tnum">
                {s.startTime}–{s.endTime} · {s.workingDays.map((d) => DAY_LABELS[d - 1]).join(" ")} · {s.breakMinutes}m break
              </div>
              <button onClick={() => void run(() => deleteSchedule(s.id), "Schedule removed")}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
          <div className="col-span-2">
            <Label className="text-xs">Applies to</Label>
            <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Start</Label><Input type="time" className="h-9" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} /></div>
          <div><Label className="text-xs">End</Label><Input type="time" className="h-9" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} /></div>
          <div><Label className="text-xs">Break (min)</Label><Input type="number" className="h-9" value={form.breakMinutes} onChange={(e) => setForm((f) => ({ ...f, breakMinutes: Number(e.target.value) }))} /></div>
          <div><Label className="text-xs">Grace (min)</Label><Input type="number" className="h-9" value={form.graceMinutes} onChange={(e) => setForm((f) => ({ ...f, graceMinutes: Number(e.target.value) }))} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DAY_LABELS.map((d, i) => (
            <button key={d} onClick={() => toggleDay(i + 1)}
              className={cn("px-3 py-1 rounded-full text-xs transition",
                form.workingDays.includes(i + 1) ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground")}>
              {d}
            </button>
          ))}
          <div className="flex-1" />
          <Button size="sm" disabled={busy} className="gap-1.5" onClick={() => void run(() => saveSchedule({
            companyId: companyDbId!,
            employeeId: form.employeeId === "all" ? null : form.employeeId,
            name: form.name, startTime: form.startTime, endTime: form.endTime,
            workingDays: form.workingDays, breakMinutes: form.breakMinutes, graceMinutes: form.graceMinutes,
          }), "Schedule saved")}>
            <Plus className="h-3.5 w-3.5" /> Add schedule
          </Button>
        </div>
      </section>

      <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-medium flex-1">Public holidays · Madagascar</h2>
          <Input type="number" className="h-9 w-24" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <Button size="sm" variant="outline" disabled={busy} className="gap-1.5"
            onClick={() => void run(async () => { await seedHolidays(companyDbId!, year); }, `Seeded ${year} holidays`)}>
            <Wand2 className="h-3.5 w-3.5" /> Seed {year}
          </Button>
        </div>
        <div className="divide-y divide-border/30 max-h-72 overflow-y-auto">
          {holidays.length === 0 && <p className="py-4 text-sm text-muted-foreground">No holidays yet — seed the Madagascar calendar.</p>}
          {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
            <div key={h.id} className="py-2 flex items-center gap-3 text-sm">
              <span className="font-tnum text-muted-foreground w-28">{h.date}</span>
              <span className="flex-1 truncate">{h.name}</span>
              {h.recurring && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground">yearly</span>}
              <button onClick={() => void run(() => deleteHoliday(h.id), "Holiday removed")}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Date</Label><Input type="date" className="h-9 w-40" value={holDate} onChange={(e) => setHolDate(e.target.value)} /></div>
          <div className="flex-1 min-w-40"><Label className="text-xs">Name</Label><Input className="h-9" value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="Holiday name" /></div>
          <Button size="sm" disabled={busy || !holName.trim()} className="gap-1.5"
            onClick={() => void run(async () => { await saveHoliday({ companyId: companyDbId!, name: holName.trim(), date: holDate, recurring: false }); setHolName(""); }, "Holiday added")}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </section>

      <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-4">
        <h2 className="text-sm font-medium flex items-center gap-2"><KeyRound className="h-4 w-4 text-muted-foreground" /> Kiosk PINs</h2>
        <p className="text-xs text-muted-foreground">Employees punch on the shared kiosk with a 4–8 digit PIN. PINs are hashed and never readable.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Employee</Label>
            <Select value={pinEmployee} onValueChange={setPinEmployee}>
              <SelectTrigger className="h-9 w-56 text-xs"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">PIN</Label><Input className="h-9 w-32 font-tnum" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
          <Button size="sm" disabled={busy || !pinEmployee || pin.length < 4} className="gap-1.5"
            onClick={() => void run(async () => { await setKioskPin({ data: { companyId: companyDbId!, employeeId: pinEmployee, pin } }); setPin(""); }, "PIN saved")}>
            Set PIN
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !pinEmployee}
            onClick={() => void run(async () => { await clearKioskPin({ data: { companyId: companyDbId!, employeeId: pinEmployee } }); }, "PIN removed")}>
            Remove
          </Button>
        </div>
      </section>
    </div>
  );
}
