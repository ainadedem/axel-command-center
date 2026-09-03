import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkMyAdminAccess } from "@/lib/users-admin.functions";
import type { AccessDiagnostics, AuditRow } from "@/lib/users-admin.types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
  ShieldCheck,
  XCircle,
  History,
  RefreshCw,
} from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  create_user: "Create user",
  assign_platform_role: "Grant platform role",
  revoke_platform_role: "Revoke platform role",
  assign_company_role: "Set company role",
  revoke_company_role: "Revoke company access",
};

/**
 * Server-truth panel: verifies the caller's admin rights and exposes the exact
 * check that fails, plus the audit trail of every user/role change attempt.
 */
export function AccessDiagnosticsPanel({ companies }: { companies: Array<{ id: string; name: string }> }) {
  const check = useServerFn(checkMyAdminAccess);
  const [diag, setDiag] = useState<AccessDiagnostics | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [openChecks, setOpenChecks] = useState(false);

  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const runCheck = async (expand = false) => {
    setChecking(true);
    setDiagError(null);
    try {
      const res = (await check()) as AccessDiagnostics;
      setDiag(res);
      if (expand) setOpenChecks(true);
      if (res.isSuperAdmin) toast.success(res.verdict);
      else if (res.canCreateUsers) toast.warning(res.verdict);
      else toast.error(res.verdict);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach the server.";
      setDiagError(message);
      toast.error(message);
    } finally {
      setChecking(false);
    }
  };

  const loadAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    const { data, error } = await supabase
      .from("user_admin_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setAuditError(error.message);
    else setAudit((data ?? []) as AuditRow[]);
    setAuditLoading(false);
  };

  const toggleAudit = async () => {
    const next = !auditOpen;
    setAuditOpen(next);
    if (next && audit === null) await loadAudit();
  };

  const companyName = (id: string | null) =>
    id ? (companies.find((c) => c.id === id)?.name ?? id.slice(0, 8)) : "—";

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-[200px]">
          <p className="t-body font-medium">Permission diagnostics</p>
          <p className="t-label text-muted-foreground">
            {diag ? diag.verdict : "Ask the server how it sees your session before creating users."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => runCheck(true)} disabled={checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Check my access
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleAudit}>
          <History className="h-4 w-4" />
          Recent activity
          {auditOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {diagError && (
        <div className="px-4 pb-3 t-label text-destructive">{diagError}</div>
      )}

      {diag && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setOpenChecks((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 t-label text-muted-foreground hover:bg-muted/40"
          >
            {openChecks ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Admin check breakdown ({diag.checks.filter((c) => c.status === "fail").length} failing)
          </button>
          {openChecks && (
            <ul className="px-4 pb-4 space-y-1.5">
              {diag.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 t-label">
                  {c.status === "pass" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  ) : c.status === "fail" ? (
                    <XCircle className="h-3.5 w-3.5 mt-0.5 text-destructive shrink-0" />
                  ) : (
                    <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="w-56 shrink-0 text-muted-foreground">{c.label}</span>
                  <span className="font-mono break-all">{c.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {auditOpen && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="t-label text-muted-foreground">Last 50 user administration attempts</p>
            <Button size="sm" variant="ghost" onClick={loadAudit} disabled={auditLoading}>
              {auditLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
          {auditError && <div className="px-4 pb-3 t-label text-destructive">{auditError}</div>}
          <div className="overflow-x-auto">
            <div className="overflow-x-auto">
            <table className="sheet sheet-pin1 w-full min-w-[720px] t-label">
              <thead className="bg-muted/40 t-micro uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">When</th>
                  <th className="text-left font-medium px-4 py-2">Actor</th>
                  <th className="text-left font-medium px-4 py-2">Action</th>
                  <th className="text-left font-medium px-4 py-2">Target</th>
                  <th className="text-left font-medium px-4 py-2">Company</th>
                  <th className="text-left font-medium px-4 py-2">Role</th>
                  <th className="text-left font-medium px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading && audit === null ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : (audit ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  (audit ?? []).map((r) => (
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">{r.actor_email ?? r.actor_user_id?.slice(0, 8) ?? "—"}</td>
                      <td className="px-4 py-2">{ACTION_LABEL[r.action] ?? r.action}</td>
                      <td className="px-4 py-2">{r.target_email ?? r.target_user_id?.slice(0, 8) ?? "—"}</td>
                      <td className="px-4 py-2">{companyName(r.company_id)}</td>
                      <td className="px-4 py-2">{r.requested_role ?? "—"}</td>
                      <td className="px-4 py-2">
                        {r.success ? (
                          <span className="text-emerald-600">Success</span>
                        ) : (
                          <span className="text-destructive" title={r.error_message ?? undefined}>
                            Failed{r.error_message ? ` — ${r.error_message}` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
