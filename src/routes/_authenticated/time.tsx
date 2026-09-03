import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, CalendarRange, BarChart3, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useProjects } from "@/lib/mock-data";
import { useAttendanceData, useCompanyMembers, toDbCompany } from "@/lib/time-attendance";
import { ClockCard, ClockActionsHint } from "@/components/time/clock-card";
import { AttendanceBoard, MyDayStrip } from "@/components/time/attendance-board";
import { TimesheetsPanel } from "@/components/time/timesheets-panel";
import { ReportsPanel, AttendanceSettings } from "@/components/time/admin-panels";
import { monthStart, monthEnd, todayKey, dayKey, entryMinutes } from "@/lib/time-calc";

export const Route = createFileRoute("/_authenticated/time")({ component: TimePage });

type Tab = "today" | "timesheets" | "reports" | "settings";

function TimePage() {
  const { scope, accessibleCompanies } = useCompany();
  const { user } = useAuth();
  const { isAdmin, isGroupAdmin, role } = useEffectiveRole();
  const canManage = isAdmin || isGroupAdmin || role === "manager";
  const [tab, setTab] = useState<Tab>("today");

  const companyDbIds = useMemo(() => {
    const locals = scope.id === "company"
      ? [scope.companyId]
      : accessibleCompanies.map((c) => c.id);
    return locals.map((id) => toDbCompany(id)).filter((v): v is string => !!v);
  }, [scope, accessibleCompanies]);

  const singleCompanyDbId = scope.id === "company" ? toDbCompany(scope.companyId) : companyDbIds.length === 1 ? companyDbIds[0] : undefined;

  // A generous window so the board, timesheets and month reports share one fetch.
  const from = monthStart(todayKey());
  const to = monthEnd(todayKey());
  const wide = useMemo(() => ({ from: `${from.slice(0, 4)}-01-01`, to: monthEnd(todayKey()) }), [from]);

  const data = useAttendanceData(companyDbIds, wide.from, wide.to);
  const { members } = useCompanyMembers(companyDbIds);

  const allProjects = useProjects();
  const projects = useMemo(
    () => allProjects
      .filter((p) => (scope.id === "group" ? true : p.companyId === scope.companyId))
      .filter((p) => /^[0-9a-f-]{36}$/i.test(p.id))
      .map((p) => ({ id: p.id, name: p.name })),
    [allProjects, scope],
  );

  const myOpen = data.entries.find((e) => e.employeeId === user?.id && !e.clockOut);
  const myTodayMinutes = data.entries
    .filter((e) => e.employeeId === user?.id && dayKey(e.clockIn) === todayKey())
    .reduce((s, e) => s + entryMinutes(e), 0);

  const visibleMembers = canManage ? members : members.filter((m) => m.userId === user?.id);

  const tabs: { id: Tab; label: string; icon: typeof Clock; admin?: boolean }[] = [
    { id: "today", label: "Today", icon: Clock },
    { id: "timesheets", label: "Timesheets", icon: CalendarRange },
    { id: "reports", label: "Reports", icon: BarChart3, admin: true },
    { id: "settings", label: "Settings", icon: Settings, admin: true },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Time & Attendance"
        description="Clock in and out, follow the team live, and build payroll-ready timesheets."
        actions={
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/kiosk">Open kiosk</Link>
          </Button>
        }
      />
      <div className="p-5 sm:p-10 lg:p-12 pt-0 space-y-6">
        <div className="inline-flex rounded-full bg-[var(--surface-container)] p-1 t-label">
          {tabs.filter((t) => !t.admin || canManage).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 transition",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "today" && (
          <div className="space-y-5">
            <ClockCard
              companyId={singleCompanyDbId ?? companyDbIds[0]}
              employeeId={user?.id}
              openEntry={myOpen}
              todayMinutes={myTodayMinutes}
              projects={projects}
              onChanged={() => void data.refresh()}
            />
            <MyDayStrip entries={data.entries} employeeId={user?.id} />
            <ClockActionsHint />
            <AttendanceBoard
              members={visibleMembers}
              entries={data.entries}
              schedules={data.schedules}
              holidays={data.holidays}
              leaves={data.leaves}
            />
          </div>
        )}

        {tab === "timesheets" && (
          <TimesheetsPanel
            members={members}
            entries={data.entries}
            schedules={data.schedules}
            holidays={data.holidays}
            leaves={data.leaves}
            timesheets={data.timesheets}
            meId={user?.id}
            canManage={canManage}
            onChanged={() => void data.refresh()}
          />
        )}

        {tab === "reports" && canManage && (
          <ReportsPanel
            members={members}
            entries={data.entries}
            schedules={data.schedules}
            holidays={data.holidays}
            leaves={data.leaves}
            projects={projects}
            companyDbIds={companyDbIds}
          />
        )}

        {tab === "settings" && canManage && (
          <AttendanceSettings
            companyDbId={singleCompanyDbId}
            members={members}
            schedules={data.schedules}
            holidays={data.holidays}
            onChanged={() => void data.refresh()}
          />
        )}
      </div>
    </AppShell>
  );
}
