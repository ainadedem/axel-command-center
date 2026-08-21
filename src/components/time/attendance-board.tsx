import { useMemo } from "react";
import { Avatar } from "@/components/avatar-upload";
import { cn } from "@/lib/utils";
import {
  dayKey, entryMinutes, fmtDuration, hhmm, liveState, scheduleFor, summarizeDays, todayKey,
  type Holiday, type LeaveRequest, type Schedule, type TimeEntry,
} from "@/lib/time-calc";
import type { Member } from "@/lib/time-attendance";
import { MapPin, Camera } from "lucide-react";

const TONE: Record<string, string> = {
  in: "text-success bg-success/10",
  out: "text-muted-foreground bg-muted/40",
  late: "text-warning bg-warning/10",
  leave: "text-primary bg-primary/10",
  off: "text-muted-foreground bg-muted/30",
};

const LABEL: Record<string, string> = {
  in: "Clocked in", out: "Out", late: "Late", leave: "On leave", off: "Off",
};

export function AttendanceBoard({
  members, entries, schedules, holidays, leaves,
}: {
  members: Member[];
  entries: TimeEntry[];
  schedules: Schedule[];
  holidays: Holiday[];
  leaves: LeaveRequest[];
}) {
  const today = todayKey();

  const rows = useMemo(() => {
    return members.map((m) => {
      const schedule = scheduleFor(schedules, m.userId, m.companyId);
      const [day] = summarizeDays({
        employeeId: m.userId, from: today, to: today,
        entries, schedule, holidays, leaves,
      });
      const open = entries.find((e) => e.employeeId === m.userId && !e.clockOut);
      const state = liveState(open, day, schedule);
      return { m, schedule, day, open, state };
    }).sort((a, b) => {
      const order = { in: 0, late: 1, out: 2, leave: 3, off: 4 } as Record<string, number>;
      return (order[a.state] - order[b.state]) || a.m.name.localeCompare(b.m.name);
    });
  }, [members, entries, schedules, holidays, leaves, today]);

  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const totalMinutes = rows.reduce((s, r) => s + (r.day?.workedMinutes ?? 0), 0);

  return (
    <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium flex-1">Live attendance · today</h2>
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(["in", "late", "out", "leave", "off"] as const).map((k) => (
            <span key={k} className={cn("px-2.5 py-1 rounded-full", TONE[k])}>
              {LABEL[k]} {counts[k] ?? 0}
            </span>
          ))}
          <span className="px-2.5 py-1 rounded-full bg-muted/40 text-muted-foreground font-tnum">
            {fmtDuration(totalMinutes)} logged
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No people with access to this workspace yet.</p>
      ) : (
        <div className="divide-y divide-border/40">
          {rows.map(({ m, day, open, state, schedule }) => (
            <div key={m.userId} className="flex items-center gap-3 py-2.5 group">
              <Avatar src={m.avatarUrl ?? undefined} name={m.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{m.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {schedule.startTime}–{schedule.endTime}
                  {day?.holiday ? ` · ${day.holiday.name}` : ""}
                  {day?.leave ? ` · ${day.leave.kind} leave` : ""}
                  {open ? ` · in since ${hhmm(open.clockIn)}` : ""}
                  {!open && day && day.entries.length > 0 ? ` · last out ${hhmm(day.entries[day.entries.length - 1].clockOut ?? day.entries[day.entries.length - 1].clockIn)}` : ""}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground">
                {open?.photoUrl && <Camera className="h-3.5 w-3.5" aria-label="Photo captured" />}
                {open?.gpsLat != null && <MapPin className="h-3.5 w-3.5" aria-label="Location captured" />}
              </div>
              <div className="text-right w-24 shrink-0">
                <div className="text-sm font-tnum">
                  {fmtDuration((day?.workedMinutes ?? 0) + (open ? Math.max(0, entryMinutes(open) - (day?.entries.includes(open) ? entryMinutes(open) : 0)) : 0))}
                </div>
                {day && day.lateMinutes > 0 && (
                  <div className="text-[10px] text-warning">{day.lateMinutes} min late</div>
                )}
              </div>
              <span className={cn("text-[11px] px-2.5 py-1 rounded-full shrink-0", TONE[state])}>{LABEL[state]}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Compact "my day" strip: the entries the signed-in user logged today. */
export function MyDayStrip({ entries, employeeId }: { entries: TimeEntry[]; employeeId?: string }) {
  const today = todayKey();
  const mine = entries
    .filter((e) => e.employeeId === employeeId && dayKey(e.clockIn) === today)
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  if (mine.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {mine.map((e) => (
        <span key={e.id} className="text-[11px] px-3 py-1.5 rounded-full bg-[var(--surface-container)] text-muted-foreground font-tnum">
          {hhmm(e.clockIn)} → {e.clockOut ? hhmm(e.clockOut) : "…"} · {fmtDuration(entryMinutes(e))}
          {e.activity ? ` · ${e.activity}` : ""}
        </span>
      ))}
    </div>
  );
}
