import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { useCompany, COMPANY_ROLES, type CompanyRole } from "@/lib/company-context";
type DbCompany = { id: string; name: string; short_name: string | null; code: string | null; color: string | null };
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users-access")({
  component: UsersAccessRoute,
});

function UsersAccessRoute() {
  return (
    <AppShell>
      <UsersAccessPage />
    </AppShell>
  );
}

type Profile = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Row = Profile & {
  /** Platform-level role (super_admin / group_admin) — empty for company-scoped users. */
  platformRole: AppRole | null;
  /** Per-company role assignments. */
  companyRoles: Map<string, CompanyRole>;
};

const PLATFORM_ROLES: Array<{ value: "none" | "super_admin" | "group_admin"; label: string }> = [
  { value: "none", label: "—" },
  { value: "group_admin", label: "Group admin" },
  { value: "super_admin", label: "Super admin" },
];

const ROLE_LABEL: Record<CompanyRole, string> = {
  company_admin: "Company admin",
  manager: "Manager",
  project_manager: "Project manager",
  sales: "Sales",
  finance: "Finance",
  viewer: "Viewer",
};

function UsersAccessPage() {
  const { isGroupAdmin } = useCompany();
  const { user: currentUser, roles: currentRoles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<DbCompany[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const isSuperAdmin = currentRoles.includes("super_admin");

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: roleRows }, { data: accessRows }, { data: companyRows }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email, avatar_url"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_company_access").select("user_id, company_id, role"),
      supabase.from("companies").select("id, name, short_name, code, color").order("name"),
    ]);
    setCompanies((companyRows ?? []) as DbCompany[]);
    const platformByUser = new Map<string, AppRole>();
    (roleRows ?? []).forEach((r: { user_id: string; role: AppRole }) => {
      // Platform roles supersede; pick the strongest if multiple exist.
      const cur = platformByUser.get(r.user_id);
      if (r.role === "super_admin") platformByUser.set(r.user_id, "super_admin");
      else if (r.role === "group_admin" && cur !== "super_admin") platformByUser.set(r.user_id, "group_admin");
    });
    const accessByUser = new Map<string, Map<string, CompanyRole>>();
    ((accessRows ?? []) as Array<{ user_id: string; company_id: string; role: string }>).forEach((r) => {
      const m = accessByUser.get(r.user_id) ?? new Map<string, CompanyRole>();
      m.set(r.company_id, r.role as CompanyRole);
      accessByUser.set(r.user_id, m);
    });
    setRows(
      (profs ?? []).map((p: Profile) => ({
        ...p,
        platformRole: platformByUser.get(p.user_id) ?? null,
        companyRoles: accessByUser.get(p.user_id) ?? new Map(),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isGroupAdmin) load();
    else setLoading(false);
  }, [isGroupAdmin]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.display_name ?? "").toLowerCase().includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const setPlatformRole = async (row: Row, value: "none" | "super_admin" | "group_admin") => {
    if (value === "super_admin" && !isSuperAdmin) {
      toast.error("Only a super admin can grant super-admin.");
      return;
    }
    if (row.platformRole === "super_admin" && !isSuperAdmin) {
      toast.error("Only a super admin can change another super admin.");
      return;
    }
    setBusy(row.user_id + ":platform");
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", row.user_id);
    if (delErr) {
      setBusy(null);
      toast.error(`Could not update role: ${delErr.message}`);
      return;
    }
    if (value !== "none") {
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: row.user_id, role: value });
      if (insErr) {
        setBusy(null);
        toast.error(`Could not set role: ${insErr.message}`);
        return;
      }
    }
    setBusy(null);
    toast.success("Platform role updated");
    setRows((prev) =>
      prev.map((r) =>
        r.user_id === row.user_id ? { ...r, platformRole: value === "none" ? null : value } : r,
      ),
    );
  };

  const setCompanyRole = async (row: Row, companyId: string, value: CompanyRole | "none") => {
    setBusy(row.user_id + ":" + companyId);
    if (value === "none") {
      const { error } = await supabase
        .from("user_company_access")
        .delete()
        .eq("user_id", row.user_id)
        .eq("company_id", companyId);
      if (error) {
        setBusy(null);
        toast.error(`Could not revoke access: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase
        .from("user_company_access")
        .upsert(
          { user_id: row.user_id, company_id: companyId, role: value },
          { onConflict: "user_id,company_id" },
        );
      if (error) {
        setBusy(null);
        toast.error(`Could not set role: ${error.message}`);
        return;
      }
    }
    setBusy(null);
    setRows((prev) =>
      prev.map((r) => {
        if (r.user_id !== row.user_id) return r;
        const next = new Map(r.companyRoles);
        if (value === "none") next.delete(companyId);
        else next.set(companyId, value);
        return { ...r, companyRoles: next };
      }),
    );
  };

  if (!isGroupAdmin) {
    return (
      <>
        <PageHeader title="Users & Access" description="Manage admins and per-company permissions." />
        <div className="px-8 py-12">
          <div className="max-w-md mx-auto text-center border border-border rounded-lg p-8 bg-card">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Restricted</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Only group administrators can manage user access.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Users & Access"
        description="Assign a platform role, then a per-company role for each user."
      />
      <div className="px-8 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "user" : "users"}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-muted/40 min-w-[260px]">
                    User
                  </th>
                  <th className="text-left font-medium px-4 py-3 min-w-[160px]">Platform</th>
                  {companies.map((c) => (
                    <th key={c.id} className="text-center font-medium px-3 py-3 min-w-[160px]">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="h-5 w-5 rounded grid place-items-center text-[9px] font-bold text-primary-foreground"
                          style={{ background: c.color ?? "#7c3aed" }}
                        >
                          {(c.short_name ?? c.code ?? c.name.slice(0, 3)).toUpperCase()}
                        </span>
                        <span className="truncate max-w-[140px]">{c.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2 + companies.length} className="px-4 py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + companies.length}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const isSelf = row.user_id === currentUser?.id;
                    const isGroupLevel =
                      row.platformRole === "super_admin" || row.platformRole === "group_admin";
                    return (
                      <tr key={row.user_id} className="border-t border-border/60 hover:bg-muted/20">
                        <td className="px-4 py-3 sticky left-0 bg-card">
                          <div className="flex items-center gap-3">
                            {row.avatar_url ? (
                              <img
                                src={row.avatar_url}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-xs font-medium">
                                {(row.display_name ?? row.email ?? "?").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium truncate flex items-center gap-2">
                                {row.display_name ?? "—"}
                                {isSelf && (
                                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                                    you
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {row.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={row.platformRole ?? "none"}
                            onValueChange={(v) =>
                              setPlatformRole(row, v as "none" | "super_admin" | "group_admin")
                            }
                            disabled={
                              busy === row.user_id + ":platform" ||
                              (isSelf && row.platformRole === "super_admin")
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATFORM_ROLES.map((r) => (
                                <SelectItem
                                  key={r.value}
                                  value={r.value}
                                  disabled={r.value === "super_admin" && !isSuperAdmin}
                                >
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {companies.map((c) => {
                          const cellKey = row.user_id + ":" + c.id;
                          const current = row.companyRoles.get(c.id) ?? "none";
                          return (
                            <td key={c.id} className="px-3 py-3">
                              <Select
                                value={isGroupLevel ? "company_admin" : current}
                                onValueChange={(v) =>
                                  setCompanyRole(row, c.id, v as CompanyRole | "none")
                                }
                                disabled={isGroupLevel || busy === cellKey}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  {isGroupLevel ? (
                                    <span className="text-muted-foreground">all access</span>
                                  ) : (
                                    <SelectValue placeholder="No access" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No access</SelectItem>
                                  {COMPANY_ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {ROLE_LABEL[r]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Platform roles</strong> apply across all companies. Super admin and group admin
            implicitly act as company admin everywhere.
          </p>
          <p>
            <strong>Company roles</strong> control what each user can read and write in that
            specific company. "No access" hides the company entirely.
          </p>
        </div>
      </div>
    </>
  );
}
