import { useCallback, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { syncSalesTeamFromRoles } from "@/lib/sales-sync.functions";
import { useCompany } from "@/lib/company-context";

/**
 * Reconciles the sales team with the app users who hold the "sales" company
 * role, then re-pulls team data so the page reflects it immediately.
 * Safe to call from any page: non-admin sessions are ignored server-side.
 */
export function useSalesRoleSync(runOnMount = true) {
  const sync = useServerFn(syncSalesTeamFromRoles);
  const { bootstrapReady, refreshTeamData } = useCompany();
  const ran = useRef(false);

  const run = useCallback(async () => {
    try {
      const res = await sync({});
      if (res && !res.skipped && (res.created || res.linked || res.removed)) {
        await refreshTeamData();
      }
    } catch (err) {
      console.warn("[sales-role-sync]", err);
    }
  }, [sync, refreshTeamData]);

  useEffect(() => {
    if (!runOnMount || !bootstrapReady || ran.current) return;
    ran.current = true;
    run();
  }, [runOnMount, bootstrapReady, run]);

  return run;
}
