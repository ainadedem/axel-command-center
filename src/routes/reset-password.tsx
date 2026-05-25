import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Supabase parses the recovery token from the URL hash and creates a
  // session. We listen for PASSWORD_RECOVERY (or an existing session) so
  // the user lands on this form instead of being redirected away.
  useEffect(() => {
    let resolved = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        resolved = true;
        setError(null);
      }
    });

    const t = setTimeout(async () => {
      if (resolved) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("This reset link is invalid or has expired. Please request a new one.");
      }
    }, 1500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none [background:var(--gradient-glow)] opacity-70" />
      <div className="flex-1 grid place-items-center px-6 py-12 relative z-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="h-8 w-8 rounded-xl bg-primary grid place-items-center">
              <span className="font-display text-base font-bold text-primary-foreground">A</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight">AXEL</span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-center">
            New password
          </h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Choose a strong password for your account.
          </p>

          {done ? (
            <div className="mt-6 text-center">
              <div className="text-sm text-muted-foreground bg-surface border border-border rounded-md px-4 py-3">
                Your password has been updated.
              </div>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm text-primary hover:opacity-90 transition"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 mt-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground">New password</label>
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
              <div>
                <label className="text-xs font-medium text-muted-foreground">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
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
                {busy ? "Saving…" : "Update password"}
              </button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
