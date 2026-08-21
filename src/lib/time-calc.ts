/**
 * Pure time & attendance maths.
 *
 * Everything is computed in Madagascar local time (UTC+3, no DST) so a shift
 * that starts at 08:00 in Antananarivo lands on the right calendar day
 * whatever the browser's timezone is.
 */

export const MG_TZ = "Indian/Antananarivo";
/** Madagascar has a fixed +03:00 offset all year. */
const MG_OFFSET_MIN = 180;

export type TimeMethod = "web" | "kiosk" | "pin";
export type TimeEntryStatus = "open" | "closed" | "approved";

export interface TimeEntry {
  id: string;
  companyId: string;
  employeeId: string;
  clockIn: string;
  clockOut: string | null;
  durationMinutes: number;
  projectId: string | null;
  activity: string | null;
  method: TimeMethod;
  photoUrl: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  note: string | null;
  billable: boolean;
  status: TimeEntryStatus;
  createdAt: string;
}

export interface Schedule {
  id: string;
  companyId: string;
  employeeId: string | null;
  role: string | null;
  name: string | null;
  startTime: string;
  endTime: string;
  workingDays: number[];
  breakMinutes: number;
  graceMinutes: number;
}

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  kind: "paid" | "unpaid" | "sick" | "other";
  startDate: string;
  endDate: string;
  halfDay: boolean;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface Holiday {
  id: string;
  companyId: string;
  name: string;
  date: string;
  recurring: boolean;
}

export const DEFAULT_SCHEDULE: Omit<Schedule, "id" | "companyId"> = {
  employeeId: null,
  role: null,
  name: "Default",
  startTime: "08:00",
  endTime: "17:00",
  workingDays: [1, 2, 3, 4, 5],
  breakMinutes: 60,
  graceMinutes: 10,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Shifts a UTC instant into Madagascar wall-clock, kept as a UTC-based Date. */
const toMg = (d: Date) => new Date(d.getTime() + MG_OFFSET_MIN * 60_000);

/** yyyy-MM-dd of an instant, in Madagascar local time. */
export function dayKey(value: string | Date): string {
  const d = toMg(typeof value === "string" ? new Date(value) : value);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** HH:mm of an instant, in Madagascar local time. */
export function hhmm(value: string | Date): string {
  const d = toMg(typeof value === "string" ? new Date(value) : value);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Minutes since midnight (Madagascar) for an instant. */
export function minutesOfDay(value: string | Date): number {
  const d = toMg(typeof value === "string" ? new Date(value) : value);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Minutes since midnight for a "HH:mm" schedule time. */
export function parseClock(t: string): number {
  const [h, m] = t.split(":");
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

/** Today's date key in Madagascar. */
export const todayKey = () => dayKey(new Date());

/** ISO weekday 1 (Mon) … 7 (Sun) of a yyyy-MM-dd key. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Monday of the week containing `key`. */
export const weekStart = (key: string) => addDays(key, -(weekdayOf(key) - 1));
/** First day of the month containing `key`. */
export const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m ?? 1, 0));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Worked minutes of an entry; open entries count up to `now`. */
export function entryMinutes(entry: TimeEntry, now = Date.now()): number {
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : now;
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}`;
}

export function fmtHours(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(2);
}

/** The schedule that applies to an employee: personal one first, then company default. */
export function scheduleFor(schedules: Schedule[], employeeId: string, companyId?: string): Schedule {
  const scoped = schedules.filter((s) => !companyId || s.companyId === companyId);
  return (
    scoped.find((s) => s.employeeId === employeeId)
    ?? scoped.find((s) => !s.employeeId)
    ?? { id: "default", companyId: companyId ?? "", ...DEFAULT_SCHEDULE }
  );
}

export function holidayOn(holidays: Holiday[], key: string): Holiday | undefined {
  const md = key.slice(5);
  return holidays.find((h) => h.date === key || (h.recurring && h.date.slice(5) === md));
}

export function leaveOn(leaves: LeaveRequest[], employeeId: string, key: string): LeaveRequest | undefined {
  return leaves.find(
    (l) => l.employeeId === employeeId && l.status === "approved" && l.startDate <= key && l.endDate >= key,
  );
}

export interface DaySummary {
  key: string;
  entries: TimeEntry[];
  workedMinutes: number;
  breakMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  leaveMinutes: number;
  unpaidLeaveMinutes: number;
  holiday?: Holiday;
  leave?: LeaveRequest;
  isWorkingDay: boolean;
  /** First clock-in later than schedule start + grace. */
  lateMinutes: number;
  missingClockOut: boolean;
}

export interface SummaryInput {
  employeeId: string;
  from: string;
  to: string;
  entries: TimeEntry[];
  schedule: Schedule;
  holidays: Holiday[];
  leaves: LeaveRequest[];
  now?: number;
}

/** Scheduled work minutes of a standard day, breaks excluded. */
export function scheduledMinutes(schedule: Schedule): number {
  const raw = parseClock(schedule.endTime) - parseClock(schedule.startTime);
  return Math.max(0, raw - schedule.breakMinutes);
}

export function summarizeDays(input: SummaryInput): DaySummary[] {
  const { employeeId, from, to, entries, schedule, holidays, leaves } = input;
  const now = input.now ?? Date.now();
  const target = scheduledMinutes(schedule);
  const byDay = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    if (e.employeeId !== employeeId) continue;
    const key = dayKey(e.clockIn);
    if (key < from || key > to) continue;
    const list = byDay.get(key) ?? [];
    list.push(e);
    byDay.set(key, list);
  }

  return eachDay(from, to).map((key) => {
    const dayEntries = (byDay.get(key) ?? []).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    const worked = dayEntries.reduce((s, e) => s + entryMinutes(e, now), 0);
    const holiday = holidayOn(holidays, key);
    const leave = leaveOn(leaves, employeeId, key);
    const isWorkingDay = schedule.workingDays.includes(weekdayOf(key)) && !holiday;
    // A single continuous shift longer than the scheduled span absorbs the
    // unpaid break; split shifts already exclude it by construction.
    const singleShift = dayEntries.length === 1 && worked > target;
    const breakMinutes = singleShift ? Math.min(schedule.breakMinutes, Math.max(0, worked - target)) : 0;
    const net = Math.max(0, worked - breakMinutes);
    const regular = isWorkingDay ? Math.min(net, target) : 0;
    const overtime = Math.max(0, net - regular);
    const leaveMinutes = leave && isWorkingDay ? Math.round(target * (leave.halfDay ? 0.5 : 1)) : 0;
    return {
      key,
      entries: dayEntries,
      workedMinutes: net,
      breakMinutes,
      regularMinutes: regular,
      overtimeMinutes: overtime,
      leaveMinutes: leave?.kind === "unpaid" ? 0 : leaveMinutes,
      unpaidLeaveMinutes: leave?.kind === "unpaid" ? leaveMinutes : 0,
      holiday,
      leave,
      isWorkingDay,
      lateMinutes:
        isWorkingDay && dayEntries[0]
          ? Math.max(0, minutesOfDay(dayEntries[0].clockIn) - parseClock(schedule.startTime) - schedule.graceMinutes)
          : 0,
      missingClockOut: dayEntries.some((e) => !e.clockOut && dayKey(e.clockIn) < todayKey()),
    };
  });
}

export interface PeriodTotals {
  regularMinutes: number;
  overtimeMinutes: number;
  breakMinutes: number;
  leaveMinutes: number;
  unpaidLeaveMinutes: number;
  workedMinutes: number;
  lateDays: number;
  missingClockOuts: number;
}

export function totalsOf(days: DaySummary[]): PeriodTotals {
  return days.reduce<PeriodTotals>(
    (acc, d) => ({
      regularMinutes: acc.regularMinutes + d.regularMinutes,
      overtimeMinutes: acc.overtimeMinutes + d.overtimeMinutes,
      breakMinutes: acc.breakMinutes + d.breakMinutes,
      leaveMinutes: acc.leaveMinutes + d.leaveMinutes,
      unpaidLeaveMinutes: acc.unpaidLeaveMinutes + d.unpaidLeaveMinutes,
      workedMinutes: acc.workedMinutes + d.workedMinutes,
      lateDays: acc.lateDays + (d.lateMinutes > 0 ? 1 : 0),
      missingClockOuts: acc.missingClockOuts + (d.missingClockOut ? 1 : 0),
    }),
    {
      regularMinutes: 0, overtimeMinutes: 0, breakMinutes: 0, leaveMinutes: 0,
      unpaidLeaveMinutes: 0, workedMinutes: 0, lateDays: 0, missingClockOuts: 0,
    },
  );
}

/** Working days in a period, holidays and weekends excluded. */
export function workingDayCount(from: string, to: string, schedule: Schedule, holidays: Holiday[]): number {
  return eachDay(from, to).filter((k) => schedule.workingDays.includes(weekdayOf(k)) && !holidayOn(holidays, k)).length;
}

export type LiveState = "in" | "out" | "late" | "leave" | "off";

/** Where an employee stands right now against their schedule. */
export function liveState(
  openEntry: TimeEntry | undefined,
  day: DaySummary | undefined,
  schedule: Schedule,
  now = Date.now(),
): LiveState {
  if (openEntry) return "in";
  if (day?.leave) return "leave";
  if (day && !day.isWorkingDay) return "off";
  const mins = minutesOfDay(new Date(now));
  if (day && day.entries.length === 0 && mins > parseClock(schedule.startTime) + schedule.graceMinutes) return "late";
  return "out";
}
