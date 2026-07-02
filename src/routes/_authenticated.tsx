import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
// Side-effect import: triggers idempotent data seeds (Logia + Axiom).
import "@/lib/pcg";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

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
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated) return null;
  return <Outlet />;
}
