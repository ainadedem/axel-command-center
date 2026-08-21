import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dbCompanyId } from "@/lib/db-sync";
import type { Holiday, LeaveRequest, Schedule, TimeEntry, TimeMethod } from "@/lib/time-calc";
import { madagascarHolidays } from "@/lib/mg-holidays";

/* ─── Row mappers ───────────────────────────────────────────────────── */

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : null);
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const entryFrom = (r: Row): TimeEntry => ({
  id: r.id as string,
  companyId: r.company_id as string,
  employeeId: r.employee_id as string,
  clockIn: r.clock_in as string,
  clockOut: s(r.clock_out),
  durationMinutes: Number(r.duration_minutes ?? 0),
  projectId: s(r.project_id),
  activity: s(r.activity),
  method: (r.method as TimeMethod) ?? "web",
  photoUrl: s(r.photo_url),
  gpsLat: n(r.gps_lat),
  gpsLng: n(r.gps_lng),
  note: s(r.note),
  billable: !!r.billable,
  status: (r.status as TimeEntry["status"]) ?? "open",
  createdAt: (r.created_at as string) ?? new Date().toISOString(),
});

const scheduleFrom = (r: Row): Schedule => ({
  id: r.id as string,
  companyId: r.company_id as string,
  employeeId: s(r.employee_id),
  role: s(r.role),
  name: s(r.name),
  startTime: String(r.start_time ?? "08:00").slice(0, 5),
  endTime: String(r.end_time ?? "17:00").slice(0, 5),
  workingDays: (r.working_days as number[]) ?? [1, 2, 3, 4, 5],
  breakMinutes: Number(r.break_minutes ?? 60),
  graceMinutes: Number(r.grace_minutes ?? 10),
});

const holidayFrom = (r: Row): Holiday => ({
  id: r.id as string,
  companyId: r.company_id as string,
  name: r.name as string,
  date: r.date as string,
  recurring: !!r.recurring,
});

const leaveFrom = (r: Row): LeaveRequest => ({
  id: r.id as string,
  companyId: r.company_id as string,
  employeeId: r.employee_id as string,
  kind: (r.kind as LeaveRequest["kind"]) ?? "paid",
  startDate: r.start_date as string,
  endDate: r.end_date as string,
  halfDay: !!r.half_day,
  note: s(r.note),
  status: (r.status as LeaveRequest["status"]) ?? "pending",
  approvedBy: s(r.approved_by),
  approvedAt: s(r.approved_at),
  createdAt: (r.created_at as string) ?? new Date().toISOString(),
});

export interface Timesheet {
  id: string;
  companyId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  regularMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
  leaveMinutes: number;
  unpaidLeaveMinutes: number;
  status: "draft" | "submitted" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
}

const timesheetFrom = (r: Row): Timesheet => ({
  id: r.id as string,
  companyId: r.company_id as string,
  employeeId: r.employee_id as string,
  periodStart: r.period_start as string,
  periodEnd: r.period_end as string,
  regularMinutes: Number(r.regular_minutes ?? 0),
  overtimeMinutes: Number(r.overtime_minutes ?? 0),
  breakMinutes: Number(r.break_minutes ?? 0),
  leaveMinutes: Number(r.leave_minutes ?? 0),
  unpaidLeaveMinutes: Number(r.unpaid_leave_minutes ?? 0),
  status: (r.status as Timesheet["status"]) ?? "draft",
  approvedBy: s(r.approved_by),
  approvedAt: s(r.approved_at),
  note: s(r.note),
});

/* ─── Company members (employees) ───────────────────────────────────── */

export interface Member {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  companyId: string;
}

/** Everyone with access to the given companies, resolved to a display profile. */
export function useCompanyMembers(companyDbIds: string[]): { members: Member[]; loading: boolean } {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const key = companyDbIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) { setMembers([]); return; }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data: access } = await supabase
        .from("user_company_access")
        .select("user_id, role, company_id")
        .in("company_id", ids);
      const rows = (access ?? []) as { user_id: string; role: string; company_id: string }[];
      if (rows.length === 0) { if (!cancelled) { setMembers([]); setLoading(false); } return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", [...new Set(rows.map((r) => r.user_id))]);
      if (cancelled) return;
      const byId = new Map(
        ((profs ?? []) as Row[]).map((p) => [p.user_id as string, p]),
      );
      const seen = new Set<string>();
      const list: Member[] = [];
      for (const r of rows) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        const p = byId.get(r.user_id);
        list.push({
          userId: r.user_id,
          name: (s(p?.display_name) || s(p?.email) || "Unknown user") as string,
          email: s(p?.email),
          avatarUrl: s(p?.avatar_url),
          role: r.role,
          companyId: r.company_id,
        });
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [key]);

  return { members, loading };
}

/* ─── Attendance data ───────────────────────────────────────────────── */

export interface AttendanceData {
  entries: TimeEntry[];
  schedules: Schedule[];
  holidays: Holiday[];
  leaves: LeaveRequest[];
  timesheets: Timesheet[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Loads everything the Time & Attendance screens need for the companies in
 * scope, and keeps `time_entries` live over Realtime so the attendance board
 * reflects clock-ins as they happen.
 */
export function useAttendanceData(companyDbIds: string[], from: string, to: string): AttendanceData {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const key = companyDbIds.join(",");
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const refresh = useCallback(async () => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setEntries([]); setSchedules([]); setHolidays([]); setLeaves([]); setTimesheets([]); setLoading(false);
      return;
    }
    setLoading(true);
    const [e, sch, hol, lv, ts] = await Promise.all([
      supabase.from("time_entries").select("*").in("company_id", ids)
        .gte("clock_in", `${from}T00:00:00Z`).lte("clock_in", `${to}T23:59:59Z`)
        .order("clock_in", { ascending: false }),
      supabase.from("schedules").select("*").in("company_id", ids),
      supabase.from("holidays").select("*").in("company_id", ids),
      supabase.from("leave_requests").select("*").in("company_id", ids),
      supabase.from("timesheets").select("*").in("company_id", ids),
    ]);
    if (!mounted.current) return;
    setEntries(((e.data ?? []) as Row[]).map(entryFrom));
    setSchedules(((sch.data ?? []) as Row[]).map(scheduleFrom));
    setHolidays(((hol.data ?? []) as Row[]).map(holidayFrom));
    setLeaves(((lv.data ?? []) as Row[]).map(leaveFrom));
    setTimesheets(((ts.data ?? []) as Row[]).map(timesheetFrom));
    setLoading(false);
  }, [key, from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Live attendance board: patch local state from postgres changes.
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;
    const channel = supabase
      .channel(`time-entries-${ids[0]}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, (payload) => {
        const row = (payload.new ?? payload.old) as Row | undefined;
        if (!row || !ids.includes(row.company_id as string)) return;
        setEntries((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((x) => x.id !== (row.id as string));
          const mapped = entryFrom(payload.new as Row);
          const i = prev.findIndex((x) => x.id === mapped.id);
          if (i === -1) return [mapped, ...prev];
          const next = [...prev];
          next[i] = mapped;
          return next;
        });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [key]);

  return { entries, schedules, holidays, leaves, timesheets, loading, refresh };
}

/* ─── Mutations ─────────────────────────────────────────────────────── */

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Local (or already-resolved) company id → database uuid. */
export const toDbCompany = (localId: string): string | undefined =>
  dbCompanyId(localId) ?? (isUuid(localId) ? localId : undefined);

async function audit(companyId: string, entryId: string, action: string, before?: unknown, after?: unknown) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("time_entry_audit").insert({
    company_id: companyId,
    entry_id: entryId,
    actor_id: data.user?.id ?? null,
    actor_name: (data.user?.user_metadata?.display_name as string) ?? data.user?.email ?? null,
    action,
    before: (before ?? null) as never,
    after: (after ?? null) as never,
  });
}

export interface ClockInInput {
  companyId: string;
  employeeId: string;
  method?: TimeMethod;
  projectId?: string | null;
  activity?: string | null;
  billable?: boolean;
  photoUrl?: string | null;
  gps?: { lat: number; lng: number } | null;
  note?: string | null;
}

export async function clockIn(input: ClockInInput): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      company_id: input.companyId,
      employee_id: input.employeeId,
      clock_in: new Date().toISOString(),
      method: input.method ?? "web",
      project_id: input.projectId && isUuid(input.projectId) ? input.projectId : null,
      activity: input.activity ?? null,
      billable: input.billable ?? false,
      photo_url: input.photoUrl ?? null,
      gps_lat: input.gps?.lat ?? null,
      gps_lng: input.gps?.lng ?? null,
      note: input.note ?? null,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const entry = entryFrom(data as Row);
  await audit(entry.companyId, entry.id, "clock_in", null, { clockIn: entry.clockIn, method: entry.method });
  return entry;
}

export async function clockOut(entry: TimeEntry): Promise<void> {
  const out = new Date().toISOString();
  const minutes = Math.max(0, Math.round((Date.parse(out) - Date.parse(entry.clockIn)) / 60_000));
  const { error } = await supabase
    .from("time_entries")
    .update({ clock_out: out, duration_minutes: minutes, status: "closed" })
    .eq("id", entry.id);
  if (error) throw new Error(error.message);
  await audit(entry.companyId, entry.id, "clock_out", { clockOut: null }, { clockOut: out, minutes });
}

export async function updateEntry(entry: TimeEntry, patch: Partial<Record<string, unknown>>): Promise<void> {
  const { error } = await supabase.from("time_entries").update(patch as never).eq("id", entry.id);
  if (error) throw new Error(error.message);
  await audit(entry.companyId, entry.id, "edit", { clockIn: entry.clockIn, clockOut: entry.clockOut }, patch);
}

export async function deleteEntry(entry: TimeEntry): Promise<void> {
  await audit(entry.companyId, entry.id, "delete", entry as unknown, null);
  const { error } = await supabase.from("time_entries").delete().eq("id", entry.id);
  if (error) throw new Error(error.message);
}

export async function approveEntries(entries: TimeEntry[]): Promise<void> {
  const ids = entries.map((e) => e.id);
  if (ids.length === 0) return;
  const { error } = await supabase.from("time_entries").update({ status: "approved" }).in("id", ids);
  if (error) throw new Error(error.message);
  for (const e of entries) await audit(e.companyId, e.id, "approve", { status: e.status }, { status: "approved" });
}

/* ─── Timesheets ────────────────────────────────────────────────────── */

export async function saveTimesheet(ts: Omit<Timesheet, "id" | "approvedBy" | "approvedAt"> & { id?: string }): Promise<string> {
  const row = {
    company_id: ts.companyId,
    employee_id: ts.employeeId,
    period_start: ts.periodStart,
    period_end: ts.periodEnd,
    regular_minutes: ts.regularMinutes,
    overtime_minutes: ts.overtimeMinutes,
    break_minutes: ts.breakMinutes,
    leave_minutes: ts.leaveMinutes,
    unpaid_leave_minutes: ts.unpaidLeaveMinutes,
    status: ts.status,
    note: ts.note,
  };
  const { data, error } = await supabase
    .from("timesheets")
    .upsert(row as never, { onConflict: "company_id,employee_id,period_start,period_end" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function approveTimesheet(id: string, approverId: string): Promise<void> {
  const { error } = await supabase
    .from("timesheets")
    .update({ status: "approved", approved_by: approverId, approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reopenTimesheet(id: string): Promise<void> {
  const { error } = await supabase
    .from("timesheets")
    .update({ status: "draft", approved_by: null, approved_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─── Leave ─────────────────────────────────────────────────────────── */

export async function createLeave(input: {
  companyId: string; employeeId: string; kind: LeaveRequest["kind"];
  startDate: string; endDate: string; halfDay: boolean; note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("leave_requests").insert({
    company_id: input.companyId,
    employee_id: input.employeeId,
    kind: input.kind,
    start_date: input.startDate,
    end_date: input.endDate,
    half_day: input.halfDay,
    note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function setLeaveStatus(id: string, status: LeaveRequest["status"], approverId?: string): Promise<void> {
  const { error } = await supabase.from("leave_requests").update({
    status,
    approved_by: status === "approved" ? approverId ?? null : null,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLeave(id: string): Promise<void> {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─── Holidays & schedules ──────────────────────────────────────────── */

export async function seedHolidays(companyId: string, year: number): Promise<number> {
  const seeds = madagascarHolidays(year);
  const { error } = await supabase.from("holidays").upsert(
    seeds.map((h) => ({ company_id: companyId, name: h.name, date: h.date, recurring: h.recurring })) as never,
    { onConflict: "company_id,date,name", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
  return seeds.length;
}

export async function saveHoliday(input: { id?: string; companyId: string; name: string; date: string; recurring: boolean }): Promise<void> {
  const row = { company_id: input.companyId, name: input.name, date: input.date, recurring: input.recurring };
  const { error } = input.id
    ? await supabase.from("holidays").update(row as never).eq("id", input.id)
    : await supabase.from("holidays").insert(row as never);
  if (error) throw new Error(error.message);
}

export async function deleteHoliday(id: string): Promise<void> {
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveSchedule(input: {
  id?: string; companyId: string; employeeId: string | null; name: string;
  startTime: string; endTime: string; workingDays: number[]; breakMinutes: number; graceMinutes: number;
}): Promise<void> {
  const row = {
    company_id: input.companyId,
    employee_id: input.employeeId,
    name: input.name,
    start_time: input.startTime,
    end_time: input.endTime,
    working_days: input.workingDays,
    break_minutes: input.breakMinutes,
    grace_minutes: input.graceMinutes,
  };
  const { error } = input.id
    ? await supabase.from("schedules").update(row as never).eq("id", input.id)
    : await supabase.from("schedules").insert(row as never);
  if (error) throw new Error(error.message);
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await supabase.from("schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ─── Audit trail ───────────────────────────────────────────────────── */

export interface AuditRow {
  id: string;
  entryId: string;
  actorName: string | null;
  action: string;
  createdAt: string;
  before: unknown;
  after: unknown;
}

export function useEntryAudit(companyDbIds: string[], enabled: boolean): AuditRow[] {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const key = companyDbIds.join(",");
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!enabled || ids.length === 0) { setRows([]); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("time_entry_audit").select("*").in("company_id", ids)
        .order("created_at", { ascending: false }).limit(300);
      if (cancelled) return;
      setRows(((data ?? []) as Row[]).map((r) => ({
        id: r.id as string,
        entryId: r.entry_id as string,
        actorName: s(r.actor_name),
        action: r.action as string,
        createdAt: r.created_at as string,
        before: r.before,
        after: r.after,
      })));
    })();
    return () => { cancelled = true; };
  }, [key, enabled]);
  return rows;
}

/** Approved timesheet minutes per employee for a month, for payroll inputs. */
export async function fetchApprovedTimesheets(companyDbId: string, month: string): Promise<Timesheet[]> {
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const endDate = new Date(Date.UTC(y, m ?? 1, 0));
  const end = endDate.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("timesheets").select("*")
    .eq("company_id", companyDbId).eq("status", "approved")
    .gte("period_start", start).lte("period_end", end);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(timesheetFrom);
}

export const useAttendanceMemoIds = (ids: (string | undefined)[]) =>
  useMemo(() => ids.filter((v): v is string => !!v), [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
