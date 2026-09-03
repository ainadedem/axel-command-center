import { useMemo } from "react";
import { Clock } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useProjects, useSalaryRegister, useTeamMembers, fmtAmount, type Currency } from "@/lib/mock-data";
import { toDbCompany, useAttendanceData } from "@/lib/time-attendance";
import { entryMinutes, fmtHours, monthEnd, monthStart, todayKey } from "@/lib/time-calc";

/**
 * Project time roll-up: hours tracked against each project this month, with an
 * indicative labour cost from the salary register and the billable share that
 * can be invoiced to the client.
 */
export function ProjectTimePanel() {
  const { scope, accessibleCompanies } = useCompany();
  const projects = useProjects();
  const team = useTeamMembers();
  const register = useSalaryRegister();

  const companyDbIds = useMemo(() => {
    const locals = scope.id === "company" ? [scope.companyId] : accessibleCompanies.map((c) => c.id);
    return locals.map((id) => toDbCompany(id)).filter((v): v is string => !!v);
  }, [scope, accessibleCompanies]);

  const from = monthStart(todayKey());
  const to = monthEnd(todayKey());
  const { entries } = useAttendanceData(companyDbIds, from, to);

  /** Hourly cost of an employee, derived from their active salary entry. */
  const hourlyOf = useMemo(() => {
    const byUser = new Map<string, number>();
    for (const s of register.filter((r) => r.active)) {
      const userId = team.find((t) => t.id === s.teamMemberId)?.userId;
      if (userId) byUser.set(userId, s.gross / 173.33);
    }
    return byUser;
  }, [register, team]);

  const rows = useMemo(() => {
    const acc = new Map<string, { minutes: number; billable: number; cost: number }>();
    for (const e of entries) {
      if (!e.projectId) continue;
      const cur = acc.get(e.projectId) ?? { minutes: 0, billable: 0, cost: 0 };
      const mins = entryMinutes(e);
      cur.minutes += mins;
      if (e.billable) cur.billable += mins;
      cur.cost += (mins / 60) * (hourlyOf.get(e.employeeId) ?? 0);
      acc.set(e.projectId, cur);
    }
    return [...acc.entries()]
      .map(([id, v]) => ({ project: projects.find((p) => p.id === id), ...v }))
      .filter((r) => r.project)
      .sort((a, b) => b.minutes - a.minutes);
  }, [entries, projects, hourlyOf]);

  if (rows.length === 0) return null;

  return (
    <section className="rounded-3xl bg-[var(--surface-container)] p-5 sm:p-7 space-y-3">
      <h2 className="t-body font-medium flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" /> Time on projects · this month
      </h2>
      <div className="divide-y divide-border/30">
        {rows.map((r) => (
          <div key={r.project!.id} className="py-2 flex items-center gap-3 t-body">
            <div className="flex-1 min-w-0 truncate">{r.project!.name}</div>
            <div className="t-label text-muted-foreground font-tnum">
              {fmtHours(r.minutes)}h · {fmtHours(r.billable)}h billable
            </div>
            <div className="w-32 text-right font-tnum t-label">
              {fmtAmount(Math.round(r.cost), (r.project!.currency ?? "MGA") as Currency)}
            </div>
          </div>
        ))}
      </div>
      <p className="t-label text-muted-foreground">
        Labour cost is indicative: hours × the person's salary-register hourly rate (173.33 h month).
      </p>
    </section>
  );
}
