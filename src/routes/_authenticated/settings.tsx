import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/avatar-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { useCompanies } from "@/lib/mock-data";
import { Building2, Users, Wallet, BookText, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeControls } from "@/components/theme-controls";
import { NotificationPrefsCard } from "@/components/notification-prefs-card";

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
  const { user, profile, roles, signOut, refresh } = useAuth();
  const companies = useCompanies();
  const [avatar, setAvatar] = useState<string | undefined>(profile?.avatar_url ?? undefined);
  const [signature, setSignature] = useState<string | undefined>(profile?.signature_url ?? undefined);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(false);

  // Hydrate the form once the profile arrives, without clobbering edits in progress.
  useEffect(() => {
    if (hydrated.current || !profile) return;
    hydrated.current = true;
    setAvatar(profile.avatar_url ?? undefined);
    setSignature(profile.signature_url ?? undefined);
    setName(profile.display_name ?? "");
  }, [profile]);

  const dirty =
    (avatar ?? null) !== (profile?.avatar_url ?? null) ||
    (signature ?? null) !== (profile?.signature_url ?? null) ||
    name.trim() !== (profile?.display_name ?? "");

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null, avatar_url: avatar ?? null, signature_url: signature ?? null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(`Could not save your profile: ${error.message}`); return; }
    await refresh();
    toast.success("Profile updated");
  };

  const cards = [
    { to: "/companies", label: "Companies", desc: `${companies.length} active`, icon: Building2 },
    { to: "/clients", label: "Clients", desc: "Manage client directory", icon: Users },
    { to: "/accounts", label: "Accounts", desc: "Bank, mobile, cash", icon: Wallet },
    { to: "/plan-comptable", label: "Plan comptable", desc: "PCG Madagascar 2005", icon: BookText },
  ] as const;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <section className="rounded-xl border border-border bg-[var(--gradient-surface)] p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account</div>
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <AvatarUpload
              value={avatar}
              onChange={setAvatar}
              name={name || user?.email || undefined}
              size={84}
              folder="profiles"
              crop
              outputSize={512}
            />
            <span className="text-[10px] text-muted-foreground">Profile picture</span>

          </div>
          <div className="flex flex-col items-center gap-2">
            <AvatarUpload
              value={signature}
              onChange={setSignature}
              name="Signature"
              size={84}
              square
              folder="signatures"
            />
            <span className="text-[10px] text-muted-foreground">Signature</span>
            {signature ? (
              <button type="button" onClick={() => setSignature(undefined)} className="text-[10px] text-muted-foreground underline focus-ring">
                Remove
              </button>
            ) : null}
          </div>
          <div className="flex-1 min-w-[240px] grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="display-name" className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input
                id="display-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1"
              />
            </div>
            <Field label="Email" value={user?.email || "—"} />
            <Field label="Roles" value={roles.length ? roles.join(", ") : "no role"} />
            <Field label="User ID" value={user?.id?.slice(0, 8) ?? "—"} mono />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Button size="sm" onClick={saveProfile} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut()} className="gap-1.5">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </section>


      <section className="rounded-xl border border-border bg-[var(--gradient-surface)] p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Appearance</div>
        <p className="text-caption text-muted-foreground mt-1">
          Theme and text size follow your device by default and are remembered on this browser.
        </p>
        <div className="mt-4 max-w-md">
          <ThemeControls />
        </div>
      </section>

      <NotificationPrefsCard />

      <section>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">Workspace</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/50 elevate focus-ring group"
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
