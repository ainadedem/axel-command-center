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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { createAppUser, logRoleChange } from "@/lib/users-admin.functions";
import { AccessDiagnosticsPanel } from "@/components/access-diagnostics-panel";
import { Loader2, ShieldAlert, Search, UserPlus } from "lucide-react";
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

/**
 * Only these roles are understood end-to-end (UI gates + database policies).
 * `manager` / `project_manager` remain readable for legacy rows but are no
 * longer offered, because they grant less than their label implies.
 */
const ASSIGNABLE_ROLES: CompanyRole[] = ["company_admin", "finance", "sales", "viewer"];
const LEGACY_ROLES: CompanyRole[] = COMPANY_ROLES.filter((r) => !ASSIGNABLE_ROLES.includes(r));

function UsersAccessPage() {
  const { isGroupAdmin } = useCompany();
  const { user: currentUser, roles: currentRoles, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [companies, setCompanies] = useState<DbCompany[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const audit = useServerFn(logRoleChange);
  /** Audit is best-effort: it must never block or fail the role change itself. */
  const recordRoleChange = (entry: Parameters<typeof audit>[0]["data"]) =>
    audit({ data: entry }).catch(() => undefined);


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

  /** Reload from the database and refresh our own session when we changed ourselves. */
  const afterWrite = async (targetUserId: string) => {
    await load();
    if (targetUserId === currentUser?.id) await refresh();
  };

  const setPlatformRole = async (row: Row, value: "none" | "super_admin" | "group_admin") => {
    if (!isSuperAdmin) {
      toast.error("Only a super admin can change platform roles.");
      return;
    }
    setBusy(row.user_id + ":platform");
    // Non-destructive: grant first, then drop the previous role. A refused insert
    // must never leave the user with no role at all.
    const logEntry = (success: boolean, errorMessage?: string) =>
      recordRoleChange({
        action: value === "none" ? "revoke_platform_role" : "assign_platform_role",
        targetUserId: row.user_id,
        targetEmail: row.email,
        requestedRole: value === "none" ? null : value,
        success,
        errorMessage: errorMessage ?? null,
      });
    if (value !== "none") {
      const { error: insErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: row.user_id, role: value }, { onConflict: "user_id,role" });
      if (insErr) {
        setBusy(null);
        void logEntry(false, insErr.message);
        toast.error(`Could not set role: ${insErr.message}`);
        return;
      }
    }
    const stale = supabase.from("user_roles").delete().eq("user_id", row.user_id);
    const { error: delErr } = value === "none" ? await stale : await stale.neq("role", value);
    if (delErr) {
      setBusy(null);
      void logEntry(false, `Stale role not removed: ${delErr.message}`);
      toast.error(`Role saved, but the previous one could not be removed: ${delErr.message}`);
      await afterWrite(row.user_id);
      return;
    }
    void logEntry(true);
    toast.success("Platform role updated");
    await afterWrite(row.user_id);
    setBusy(null);
  };


  const setCompanyRole = async (row: Row, companyId: string, value: CompanyRole | "none") => {
    setBusy(row.user_id + ":" + companyId);
    const logEntry = (success: boolean, errorMessage?: string) =>
      recordRoleChange({
        action: value === "none" ? "revoke_company_role" : "assign_company_role",
        targetUserId: row.user_id,
        targetEmail: row.email,
        companyId,
        requestedRole: value === "none" ? null : value,
        success,
        errorMessage: errorMessage ?? null,
      });
    if (value === "none") {
      const { error } = await supabase
        .from("user_company_access")
        .delete()
        .eq("user_id", row.user_id)
        .eq("company_id", companyId);
      if (error) {
        setBusy(null);
        void logEntry(false, error.message);
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
        void logEntry(false, error.message);
        toast.error(`Could not set role: ${error.message}`);
        return;
      }
    }
    void logEntry(true);
    toast.success(value === "none" ? "Access revoked" : `Set to ${ROLE_LABEL[value]}`);

    await afterWrite(row.user_id);
    setBusy(null);
  };

  const effectiveAccess = (row: Row): string => {
    if (row.platformRole === "super_admin") return "All companies · super admin";
    if (row.platformRole === "group_admin") return "All companies · group admin";
    if (row.companyRoles.size === 0) return "No access";
    return companies
      .filter((c) => row.companyRoles.has(c.id))
      .map((c) => `${c.short_name ?? c.code ?? c.name}: ${ROLE_LABEL[row.companyRoles.get(c.id)!]}`)
      .join(" · ");
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
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        </div>

        <AddUserDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          companies={companies}
          isSuperAdmin={isSuperAdmin}
          onCreated={load}
        />

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3 sticky left-0 bg-muted/40 min-w-[260px]">
                    User
                  </th>
                  <th className="text-left font-medium px-4 py-3 min-w-[160px]">Platform</th>
                  <th className="text-left font-medium px-4 py-3 min-w-[220px]">Effective access</th>
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
                    <td colSpan={3 + companies.length} className="px-4 py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + companies.length}
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
                              !isSuperAdmin ||
                              busy === row.user_id + ":platform" ||
                              (isSelf && row.platformRole === "super_admin")
                            }
                          >
                            <SelectTrigger
                              className="h-8 text-xs"
                              title={isSuperAdmin ? undefined : "Only a super admin can change platform roles."}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATFORM_ROLES.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[280px]">
                          {effectiveAccess(row)}
                        </td>
                        {companies.map((c) => {
                          const cellKey = row.user_id + ":" + c.id;
                          const current = row.companyRoles.get(c.id) ?? "none";
                          const isLegacy = current !== "none" && LEGACY_ROLES.includes(current as CompanyRole);
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
                                  {ASSIGNABLE_ROLES.map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {ROLE_LABEL[r]}
                                    </SelectItem>
                                  ))}
                                  {isLegacy && (
                                    <SelectItem value={current}>
                                      {ROLE_LABEL[current as CompanyRole]} (legacy)
                                    </SelectItem>
                                  )}
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

function AddUserDialog({
  open,
  onOpenChange,
  companies,
  isSuperAdmin,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: DbCompany[];
  isSuperAdmin: boolean;
  onCreated: () => Promise<void> | void;
}) {
  const createUser = useServerFn(createAppUser);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [password, setPassword] = useState("");
  const [platformRole, setPlatformRole] = useState<"none" | "group_admin" | "super_admin">("none");
  const [roles, setRoles] = useState<Record<string, CompanyRole | "none">>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEmail("");
    setDisplayName("");
    setMode("invite");
    setPassword("");
    setPlatformRole("none");
    setRoles({});
    setError(null);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const companyRoles = Object.entries(roles)
        .filter(([, r]) => r && r !== "none")
        .map(([companyId, role]) => ({ companyId, role: role as string }));
      const res = await createUser({
        data: {
          email,
          displayName: displayName.trim() || undefined,
          mode,
          password: mode === "password" ? password : undefined,
          platformRole: platformRole === "none" ? null : platformRole,
          companyRoles,
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        },
      });
      toast.success(res.invited ? `Invitation sent to ${res.email}` : `Account created for ${res.email}`);
      reset();
      onOpenChange(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Create an account and grant access. Company roles can be changed later from the table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-user-email">Email</Label>
              <Input
                id="new-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-user-name">Full name</Label>
              <Input
                id="new-user-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>How to activate</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "invite" | "password")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invite">Send invitation email</SelectItem>
                  <SelectItem value="password">Set a temporary password</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "password" ? (
              <div className="space-y-1.5">
                <Label htmlFor="new-user-password">Temporary password</Label>
                <Input
                  id="new-user-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Platform role</Label>
                <Select
                  value={platformRole}
                  onValueChange={(v) => setPlatformRole(v as typeof platformRole)}
                  disabled={!isSuperAdmin}
                >
                  <SelectTrigger title={isSuperAdmin ? undefined : "Only a super admin can grant platform roles."}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {mode === "password" && (
            <div className="space-y-1.5">
              <Label>Platform role</Label>
              <Select
                value={platformRole}
                onValueChange={(v) => setPlatformRole(v as typeof platformRole)}
                disabled={!isSuperAdmin}
              >
                <SelectTrigger title={isSuperAdmin ? undefined : "Only a super admin can grant platform roles."}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Company access</Label>
            {platformRole !== "none" ? (
              <p className="text-xs text-muted-foreground">
                Platform admins already have access to every company.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border border-border p-3">
                {companies.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate">{c.name}</span>
                    <Select
                      value={roles[c.id] ?? "none"}
                      onValueChange={(v) =>
                        setRoles((prev) => ({ ...prev, [c.id]: v as CompanyRole | "none" }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No access</SelectItem>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {companies.length === 0 && (
                  <p className="text-xs text-muted-foreground">No companies yet.</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !email.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "invite" ? "Send invitation" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
