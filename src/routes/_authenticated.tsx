import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { SALES_ROUTES } from "@/components/app-shell";
import { CompanyProvider } from "@/lib/company-context";
// Side-effect import: triggers idempotent data seeds (Logia + Axiom).
import "@/lib/pcg";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

/**
 * Sales scoping is per company, so this gate lives inside CompanyProvider where
 * the effective role for the selected company is known.
 */
function SalesScopeGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const { isSalesOnly, roleResolved } = useEffectiveRole();

  useEffect(() => {
    // Wait for company access to load: before it does every non-platform user
    // looks sales-only and would be bounced away from the page they opened.
    if (!roleResolved || !isSalesOnly) return;
    const allowed = SALES_ROUTES.some((r) => location.pathname === r || location.pathname.startsWith(`${r}/`));
    if (!allowed) navigate({ to: "/quotations", replace: true });
  }, [isSalesOnly, roleResolved, location.pathname, navigate]);

  return <>{children}</>;
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated && location.pathname !== "/login") {
      const redirectTo = location.pathname.startsWith("/") ? location.href : "/";
      navigate({ to: "/login", search: { redirect: redirectTo } });
    }
  }, [loading, isAuthenticated, location.href, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="t-body text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated) return null;
  return (
    <CompanyProvider>
      <SalesScopeGate>
        <Outlet />
      </SalesScopeGate>
    </CompanyProvider>
  );
}
