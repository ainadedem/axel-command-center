import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s.redirect as string) || "/",
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        // auto-confirm is on, so sign in immediately
        const { error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) throw siErr;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: search.redirect });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none [background:var(--gradient-glow)] opacity-70" />
      <div className="hidden lg:flex w-1/2 relative items-end p-12 border-r border-border">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center">
              <span className="font-display text-lg font-bold text-primary-foreground">A</span>
            </div>
            <div>
              <div className="font-display text-xl font-bold tracking-tight leading-none">AXEL</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">Control System</div>
            </div>
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight leading-[1.05] max-w-md">
            The Axiom<br />Winford Group.
          </h1>
          <p className="mt-6 text-muted-foreground max-w-sm leading-relaxed">
            Multi-company, multi-currency control of cash, revenue, and pipeline — engineered for clarity.
          </p>
        </div>
      </div>

      <div className="flex-1 grid place-items-center px-6 py-12 relative z-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="h-8 w-8 rounded-xl bg-primary grid place-items-center">
              <span className="font-display text-base font-bold text-primary-foreground">A</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight">AXEL</span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight">
            {mode === "signup" ? "Create admin account" : "Sign in"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup"
              ? "The first account becomes the Group Admin."
              : "Welcome back to your control room."}
          </p>

          <div className="mt-5 inline-flex rounded-md border border-border p-0.5 bg-surface text-xs">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className={`px-3 h-7 rounded ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >Sign in</button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); }}
              className={`px-3 h-7 rounded ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >Create account</button>
          </div>

          <form onSubmit={handleEmail} className="space-y-3 mt-5">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>

            {mode === "signin" && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition">
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          <p className="mt-8 text-[10px] text-muted-foreground/70 text-center">
            Accounts are provisioned by your group admin. Contact them for access.
          </p>
        </div>
      </div>
    </div>
  );
}
