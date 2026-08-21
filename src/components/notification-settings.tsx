import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCompanies } from "@/lib/mock-data";
import { dbCompanyId } from "@/lib/db-sync";
import {
  NOTIFICATION_EVENTS,
  resolveEventPrefs,
  resolveWatchRules,
  type EventChannels,
  type NotificationEventKey,
  type WatchRules,
} from "@/lib/notification-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Bell, Loader2 } from "lucide-react";

const STAGES = [15, 30, 45, 60] as const;
const STAGE_HINT: Record<number, string> = {
  15: "Courtesy confirmation",
  30: "Written follow-up",
  45: "Formal reminder",
  60: "Executive escalation",
};

/**
 * One place to decide what reaches you and how: per-event in-app / email
 * channels, the receivables ladder, and (for admins) which companies and
 * documents to watch even when you are not assigned.
 */
export function NotificationSettings() {
  const { user, roles } = useAuth() as { user?: { id?: string } | null; roles?: string[] };
  const userId = user?.id;
  const companies = useCompanies();

  const isAdmin = useMemo(
    () => (roles ?? []).some((r) => ["super_admin", "group_admin", "company_admin", "finance"].includes(r)),
    [roles],
  );

  const [events, setEvents] = useState<Record<NotificationEventKey, EventChannels>>(() => resolveEventPrefs({}));
  const [arEnabled, setArEnabled] = useState(true);
  const [stages, setStages] = useState<number[]>([...STAGES]);
  const [watchCompanies, setWatchCompanies] = useState<string[]>([]);
  const [rules, setRules] = useState<WatchRules>(() => resolveWatchRules({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("notification_prefs")
      .select("ar_alerts_enabled, stages, events, watch_company_ids, watch_rules")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setArEnabled(data.ar_alerts_enabled as boolean);
          setStages((data.stages as number[]) ?? [...STAGES]);
          setEvents(resolveEventPrefs(data.events));
          setWatchCompanies((data.watch_company_ids as string[]) ?? []);
          setRules(resolveWatchRules(data.watch_rules));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const toggleStage = (s: number) =>
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort((a, b) => a - b)));

  const setChannel = (key: NotificationEventKey, channel: keyof EventChannels, value: boolean) =>
    setEvents((prev) => ({ ...prev, [key]: { ...prev[key], [channel]: value } }));

  const toggleCompany = (dbId: string) =>
    setWatchCompanies((prev) => (prev.includes(dbId) ? prev.filter((x) => x !== dbId) : [...prev, dbId]));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase.from("notification_prefs").upsert(
      {
        user_id: userId,
        ar_alerts_enabled: arEnabled,
        stages,
        events: events as never,
        watch_company_ids: watchCompanies,
        watch_rules: { minAmount: rules.minAmount ?? null, watchUnassigned: rules.watchUnassigned !== false } as never,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notification preferences saved.");
  };

  return (
    <section className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-base font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Notifications
        </h2>
        <p className="text-xs text-muted-foreground">
          Choose what reaches you in the app and, optionally, by email. You are never notified about your own actions.
        </p>
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-2 bg-[var(--surface-container)] text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Event</span><span className="text-center w-14">In-app</span><span className="text-center w-14">Email</span>
            </div>
            {NOTIFICATION_EVENTS.map((e) => (
              <div key={e.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-3 py-2.5 border-t border-border/60">
                <div className="min-w-0">
                  <div className="text-sm">{e.label}</div>
                  <div className="text-[11px] text-muted-foreground">{e.description}</div>
                </div>
                <div className="w-14 flex justify-center">
                  <Switch
                    checked={events[e.key].inApp}
                    onCheckedChange={(v) => setChannel(e.key, "inApp", v)}
                    aria-label={`${e.label} in app`}
                  />
                </div>
                <div className="w-14 flex justify-center">
                  <Switch
                    checked={events[e.key].email}
                    onCheckedChange={(v) => setChannel(e.key, "email", v)}
                    aria-label={`${e.label} by email`}
                  />
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Watch scope</div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="watch-unassigned" className="text-sm font-normal">
                  Notify me about documents I am not assigned to
                </Label>
                <Switch
                  id="watch-unassigned"
                  checked={rules.watchUnassigned !== false}
                  onCheckedChange={(v) => setRules((r) => ({ ...r, watchUnassigned: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="min-amount" className="text-sm font-normal">Only above this amount</Label>
                <Input
                  id="min-amount"
                  type="number"
                  min={0}
                  className="h-8 w-40 font-tnum"
                  value={rules.minAmount ?? ""}
                  placeholder="Any amount"
                  onChange={(e) =>
                    setRules((r) => ({ ...r, minAmount: e.target.value ? Number(e.target.value) : undefined }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground">
                  Companies to watch — none selected means all companies you can access.
                </div>
                <div className="flex flex-wrap gap-2">
                  {companies.map((c) => {
                    const dbId = dbCompanyId(c.id);
                    if (!dbId) return null;
                    const on = watchCompanies.includes(dbId);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCompany(dbId)}
                        aria-pressed={on}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs transition-all press-scale flex items-center gap-1.5",
                          on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                        {c.shortName || c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="ar-alerts" className="text-sm font-normal">
                Email me when an invoice reaches a new collection step
              </Label>
              <Switch id="ar-alerts" checked={arEnabled} onCheckedChange={setArEnabled} aria-label="Enable receivables alerts" />
            </div>
            <div className={cn("space-y-2", !arEnabled && "opacity-50 pointer-events-none")}>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Steps to be alerted on</div>
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleStage(s)}
                    aria-pressed={stages.includes(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs transition-all press-scale text-left",
                      stages.includes(s)
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="font-medium">Day {s}</span>
                    <span className="block text-[10px] opacity-80">{STAGE_HINT[s]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />} Save preferences
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
