import { Link } from "@tanstack/react-router";
import { ShieldAlert, Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL, type Action, type Resource } from "@/lib/permissions";
import type { ReactNode } from "react";

/**
 * Wrap a page body. If the user lacks "view" permission, render a 403.
 * If they can view but not edit, render the children inside a "read-only" banner.
 */
export function AccessGate({
  resource,
  children,
}: {
  resource: Resource;
  children: ReactNode;
}) {
  const { can, roles, loading } = useAuth();
  if (loading) return null;
  if (!can(resource, "view")) return <Forbidden resource={resource} />;
  const readOnly = !can(resource, "edit");
  return (
    <>
      {readOnly && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          Read-only access · Your role
          {roles.length ? ` (${roles.map((r) => ROLE_LABEL[r]).join(", ")})` : ""} can view but not edit this section.
        </div>
      )}
      {children}
    </>
  );
}

function Forbidden({ resource }: { resource: Resource }) {
  const { roles } = useAuth();
  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 border border-destructive/30 grid place-items-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role{roles.length ? ` (${roles.map((r) => ROLE_LABEL[r]).join(", ")})` : ""} does
          not have permission to view <span className="text-foreground font-medium">{resource}</span>.
          Contact your Group Admin if you need access.
        </p>
        <Link to="/" className="inline-block mt-6 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

/** Inline gate — hides children entirely when user lacks the action. */
export function Can({
  resource,
  action,
  children,
  fallback = null,
}: {
  resource: Resource;
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(resource, action) ? children : fallback}</>;
}
