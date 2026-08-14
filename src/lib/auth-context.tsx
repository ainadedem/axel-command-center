import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "group_admin" | "company_admin" | "manager" | "project_manager" | "finance" | "sales" | "viewer";

const APP_ROLES: AppRole[] = ["super_admin", "group_admin", "company_admin", "manager", "project_manager", "finance", "sales", "viewer"];
const isAppRole = (r: string): r is AppRole => (APP_ROLES as string[]).includes(r);

export interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  /** Personal signature image, printed on documents this user creates/edits. */
  signature_url?: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  /** Role granted per company id (from user_company_access). */
  companyRoles: Record<string, AppRole>;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  /** Role that applies inside a given company (global admin roles win). */
  roleFor: (companyId?: string | null) => AppRole | null;
  /** True when the user is a sales rep with no admin/finance role — sales-only scope. */
  isSalesOnly: boolean;
  /** True when the user may see money: admins, managers and finance. */
  canSeeFinance: boolean;
  /** True for group/super admins and company admins. */
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const defaultAuthState: AuthState = {
  session: null,
  user: null,
  profile: null,
  roles: [],
  companyRoles: {},
  loading: true,
  isAuthenticated: false,
  hasRole: () => false,
  roleFor: () => null,
  isSalesOnly: false,
  canSeeFinance: false,
  isAdmin: false,
  signOut: async () => {},
  refresh: async () => {},
};

const AuthCtx = createContext<AuthState>(defaultAuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companyRoles, setCompanyRoles] = useState<Record<string, AppRole>>({});
  const [loading, setLoading] = useState(true);
  // Tracks which user the current state belongs to, so repeated SIGNED_IN /
  // INITIAL_SESSION events (fired by the auth client on tab focus) become no-ops.
  const currentUserIdRef = useRef<string | null>(null);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roleRows }, { data: accessRows }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, email, avatar_url").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_company_access").select("company_id, role").eq("user_id", uid),
    ]);
    setProfile((prev) => {
      const next = prof ?? null;
      if (prev && next && prev.user_id === next.user_id && prev.display_name === next.display_name
        && prev.email === next.email && prev.avatar_url === next.avatar_url) return prev;
      return next;
    });
    const access = (accessRows ?? []) as { company_id: string; role: string }[];
    setCompanyRoles((prev) => {
      const next: Record<string, AppRole> = {};
      for (const r of access) if (isAppRole(r.role)) next[r.company_id] = r.role;
      const prevKeys = Object.keys(prev);
      const same = prevKeys.length === Object.keys(next).length && prevKeys.every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
    setRoles((prev) => {
      // Roles come from two places: the global `user_roles` table (super/group admin)
      // and the per-company `user_company_access` table (company_admin, finance, sales…).
      // Reading only the first one left every company-scoped user with no role at all,
      // which silently granted them the full admin UI.
      const global = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);
      const scoped = access.map((r) => r.role).filter(isAppRole);
      const next = Array.from(new Set([...global, ...scoped])) as AppRole[];
      const same = prev.length === next.length && prev.every((r, i) => r === next[i]);
      return same ? prev : next;
    });
  };


  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT" || !s?.user) {
        currentUserIdRef.current = null;
        setSession(s ?? null);
        setProfile(null);
        setRoles([]);
        setCompanyRoles({});
        return;
      }

      // Token refreshes and re-announcements of the same session (tab focus)
      // must not churn state — that re-renders the app and resets open forms.
      if (event === "TOKEN_REFRESHED") return;
      if (currentUserIdRef.current === s.user.id) return;

      currentUserIdRef.current = s.user.id;
      setSession(s);

      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") {
        // defer to avoid deadlock
        setTimeout(() => loadUserData(s.user.id), 0);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (s?.user && currentUserIdRef.current === s.user.id) return;
        currentUserIdRef.current = s?.user?.id ?? null;
        setSession(s);
        if (s?.user) return loadUserData(s.user.id);
      })
      .catch(() => {
        currentUserIdRef.current = null;
        setSession(null);
        setProfile(null);
        setRoles([]);
        setCompanyRoles({});
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    const isGlobalAdmin = roles.includes("super_admin") || roles.includes("group_admin");
    const financeRoles: AppRole[] = ["super_admin", "group_admin", "company_admin", "manager", "finance"];
    const canSeeFinance = roles.some((r) => financeRoles.includes(r));
    return {
      session,
      user: session?.user ?? null,
      profile,
      roles,
      companyRoles,
      loading,
      isAuthenticated: !!session,
      hasRole: (r) => roles.includes(r),
      roleFor: (companyId) => {
        if (isGlobalAdmin) return roles.includes("super_admin") ? "super_admin" : "group_admin";
        if (!companyId) return roles[0] ?? null;
        return companyRoles[companyId] ?? null;
      },
      // A signed-in user with no role at all is treated as sales-scoped, never as an admin.
      isSalesOnly: !canSeeFinance,
      canSeeFinance,
      isAdmin: isGlobalAdmin || roles.includes("company_admin"),
      signOut: async () => { await supabase.auth.signOut(); },
      refresh: async () => { if (session?.user) await loadUserData(session.user.id); },
    };
  }, [session, profile, roles, companyRoles, loading]);


  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}


export const useAuth = () => {
  return useContext(AuthCtx);
};
