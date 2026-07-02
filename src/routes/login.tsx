import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import axelLogo from "@/assets/axel-logo.png";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: (s.redirect as string) || "/",
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: search.redirect });
  },
  head: () => ({
    meta: [
      { title: "Sign in — AXEL" },
      { name: "description", content: "Sign in to AXEL, the premium multi-company, multi-currency ERP, CRM and accounting command center." },
      { property: "og:title", content: "Sign in — AXEL" },
      { property: "og:description", content: "Sign in to AXEL, the premium multi-company, multi-currency ERP, CRM and accounting command center." },
      { property: "og:url", content: "https://axel-command-center.lovable.app/login" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://axel-command-center.lovable.app/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: search.redirect });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full [background:var(--gradient-glow)] opacity-60 blur-3xl" />
      </div>

      {/* Centered login card */}
      <div className="flex-1 grid place-items-center px-6 py-12 relative z-10">
        <div className="w-full max-w-[22rem]">
          {/* Logo */}
          <div className="flex justify-center mb-10">
            <img
              src={axelLogo}
              alt="AXEL Business Platform logo"
              className="h-16 w-auto"
            />
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in to your Axel account
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition placeholder:text-muted-foreground/50"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring transition placeholder:text-muted-foreground/50"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 shadow-[0_4px_14px_-4px_oklch(0.47_0.31_293/0.45)]"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>

      {/* Modern gradient footer */}
      <div className="relative z-10">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <div className="px-6 py-6 text-center">
          <p className="text-[11px] text-muted-foreground/60 tracking-wide">
            Axel — Multi-company command center
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-1 tracking-wide">
            The Axiom Winford Group
          </p>
        </div>
      </div>
    </div>
  );
}
