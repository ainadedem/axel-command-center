import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
  roles: AppRole[];
  companyIds: Set<string>;
};

const ROLES: AppRole[] = ["super_admin", "group_admin", "company_admin", "finance", "sales", "viewer"];

function UsersAccessPage() {
  const { isGroupAdmin, accessibleCompanies } = useCompany();
  const { user: currentUser, roles: currentRoles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const isSuperAdmin = currentRoles.includes("super_admin");

  const load = async () => {
    setLoading(true);
    const [{ data: profs }, { data: roleRows }, { data: accessRows }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email, avatar_url"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_company_access").select("user_id, company_id"),
    ]);
    const rolesByUser = new Map<string, AppRole[]>();
    (roleRows ?? []).forEach((r: { user_id: string; role: AppRole }) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    });
    const accessByUser = new Map<string, Set<string>>();
    (accessRows ?? []).forEach((r: { user_id: string; company_id: string }) => {
      const set = accessByUser.get(r.user_id) ?? new Set<string>();
      set.add(r.company_id);
      accessByUser.set(r.user_id, set);
    });
    setRows(
      (profs ?? []).map((p: Profile) => ({
        ...p,
        roles: rolesByUser.get(p.user_id) ?? [],
        companyIds: accessByUser.get(p.user_id) ?? new Set(),
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

  const primaryRole = (r: Row): AppRole => r.roles[0] ?? "viewer";

  const setRole = async (row: Row, role: AppRole) => {
    if (!isSuperAdmin && (role === "super_admin" || row.roles.includes("super_admin"))) {
      toast.error("Only a super admin can manage super-admin roles.");
      return;
    }
    setBusy(row.user_id);
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", row.user_id);
    if (delErr) {
      setBusy(null);
      toast.error(`Could not update role: ${delErr.message}`);
      return;
    }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: row.user_id, role });
    setBusy(null);
    if (insErr) {
      toast.error(`Could not set role: ${insErr.message}`);
      return;
    }
    toast.success("Role updated");
    setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, roles: [role] } : r)));
  };

  const toggleCompany = async (row: Row, companyId: string, checked: boolean) => {
    setBusy(row.user_id + ":" + companyId);
    if (checked) {
      const { error } = await supabase
        .from("user_company_access")
        .insert({ user_id: row.user_id, company_id: companyId });
      if (error) {
        setBusy(null);
        toast.error(`Could not grant access: ${error.message}`);
        return;
      }
    } else {
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
    }
    setBusy(null);
    setRows((prev) =>
      prev.map((r) => {
        if (r.user_id !== row.user_id) return r;
        const next = new Set(r.companyIds);
        if (checked) next.add(companyId);
        else next.delete(companyId);
        return { ...r, companyIds: next };
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
        description="Assign roles and choose which companies each user can access."
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
                  <th className="text-left font-medium px-4 py-3 min-w-[180px]">Role</th>
                  {accessibleCompanies.map((c) => (
                    <th key={c.id} className="text-center font-medium px-3 py-3 min-w-[110px]">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="h-5 w-5 rounded grid place-items-center text-[9px] font-bold text-primary-foreground"
                          style={{ background: c.color }}
                        >
                          {c.shortName}
                        </span>
                        <span className="truncate max-w-[100px]">{c.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={2 + accessibleCompanies.length} className="px-4 py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + accessibleCompanies.length}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const role = primaryRole(row);
                    const isSelf = row.user_id === currentUser?.id;
                    const isGroupLevel = role === "super_admin" || role === "group_admin";
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
                            value={role}
                            onValueChange={(v) => setRole(row, v as AppRole)}
                            disabled={busy === row.user_id || (isSelf && role === "super_admin")}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem
                                  key={r}
                                  value={r}
                                  disabled={r === "super_admin" && !isSuperAdmin}
                                >
                                  {r.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {accessibleCompanies.map((c) => {
                          const cellKey = row.user_id + ":" + c.id;
                          const checked = isGroupLevel || row.companyIds.has(c.id);
                          return (
                            <td key={c.id} className="px-3 py-3 text-center">
                              <div className="inline-flex flex-col items-center gap-0.5">
                                <Checkbox
                                  checked={checked}
                                  disabled={isGroupLevel || busy === cellKey}
                                  onCheckedChange={(v) => toggleCompany(row, c.id, v === true)}
                                />
                                {isGroupLevel && (
                                  <span className="text-[9px] text-muted-foreground">all</span>
                                )}
                              </div>
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

        <p className="text-xs text-muted-foreground">
          Super admins and group admins automatically have access to every company. For other roles,
          tick the companies they can view and work in.
        </p>
      </div>
    </AppShell>
  );
}
