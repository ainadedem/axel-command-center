import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { useCompanies } from "@/lib/mock-data";
import { Building2, Users, Wallet, BookText, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppShell>
      <PageHeader title="Settings" description="Workspace, companies, and account preferences." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { user, profile, roles, signOut } = useAuth();
  const companies = useCompanies();

  const cards = [
    { to: "/companies", label: "Companies", desc: `${companies.length} active`, icon: Building2 },
    { to: "/clients", label: "Clients", desc: "Manage client directory", icon: Users },
    { to: "/accounts", label: "Accounts", desc: "Bank, mobile, cash", icon: Wallet },
    { to: "/plan-comptable", label: "Plan comptable", desc: "PCG Madagascar 2005", icon: BookText },
  ] as const;

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <section className="rounded-xl border border-border bg-[var(--gradient-surface)] p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account</div>
        <div className="mt-3 grid sm:grid-cols-2 gap-4">
          <Field label="Name" value={profile?.display_name || "—"} />
          <Field label="Email" value={user?.email || "—"} />
          <Field label="Roles" value={roles.length ? roles.join(", ") : "no role"} />
          <Field label="User ID" value={user?.id?.slice(0, 8) ?? "—"} mono />
        </div>
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={() => signOut()} className="gap-1.5">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </section>

      <section>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">Workspace</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/10 grid place-items-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.desc}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
