import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useCompanies } from "@/lib/mock-data";
import { dbCompanyId } from "@/lib/db-sync";
import {
  NOTIFICATION_EVENTS,
  EVENT_GROUPS,
  EMAIL_MODE_LABEL,
  DEFAULT_QUIET_HOURS,
  resolveEventPrefs,
  resolveWatchRules,
  resolveEmailModes,
  resolveQuietHours,
  type EmailMode,
  type EventChannels,
  type NotificationEventKey,
  type QuietHours,
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

  const localZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
  }, []);

  const [events, setEvents] = useState<Record<NotificationEventKey, EventChannels>>(() => resolveEventPrefs({}));
  const [modes, setModes] = useState<Record<NotificationEventKey, EmailMode>>(() =>
    resolveEmailModes({}, resolveEventPrefs({})),
  );
  const [quiet, setQuiet] = useState<QuietHours>(() => ({ ...DEFAULT_QUIET_HOURS }));
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
      .select("ar_alerts_enabled, stages, events, watch_company_ids, watch_rules, quiet_hours, digest_modes, time_zone")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const row = data as Record<string, unknown>;
          const channels = resolveEventPrefs(row["events"]);
          setArEnabled(row["ar_alerts_enabled"] as boolean);
          setStages((row["stages"] as number[]) ?? [...STAGES]);
          setEvents(channels);
          setModes(resolveEmailModes(row["digest_modes"], channels));
          setQuiet(resolveQuietHours(row["quiet_hours"], (row["time_zone"] as string) ?? localZone));
          setWatchCompanies((row["watch_company_ids"] as string[]) ?? []);
          setRules(resolveWatchRules(row["watch_rules"]));
        } else {
          setQuiet((q) => ({ ...q, timeZone: localZone }));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, localZone]);

  const toggleStage = (s: number) =>
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort((a, b) => a - b)));

  const setChannel = (key: NotificationEventKey, channel: keyof EventChannels, value: boolean) =>
    setEvents((prev) => ({ ...prev, [key]: { ...prev[key], [channel]: value } }));

  const setMode = (key: NotificationEventKey, mode: EmailMode) => {
    setModes((prev) => ({ ...prev, [key]: mode }));
    // Keep the legacy boolean in sync so older code paths stay correct.
    setEvents((prev) => ({ ...prev, [key]: { ...prev[key], email: mode !== "off" } }));
  };

  /** Turn a whole group on or off in one click. */
  const setGroup = (kinds: NotificationEventKey[], on: boolean) =>
    setEvents((prev) => {
      const next = { ...prev };
      for (const k of kinds) next[k] = { ...next[k], inApp: on };
      return next;
    });

  const muteGroup = (kinds: NotificationEventKey[]) => {
    setGroup(kinds, false);
    setModes((prev) => {
      const next = { ...prev };
      for (const k of kinds) next[k] = "off";
      return next;
    });
    setEvents((prev) => {
      const next = { ...prev };
      for (const k of kinds) next[k] = { inApp: false, email: false };
      return next;
    });
  };

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
        digest_modes: modes as never,
        quiet_hours: {
          enabled: quiet.enabled,
          start: quiet.start,
          end: quiet.end,
          timeZone: quiet.timeZone ?? localZone ?? null,
        } as never,
        time_zone: quiet.timeZone ?? localZone ?? null,
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
              <span>Event</span><span className="text-center w-14">In-app</span><span className="text-center w-32">Email</span>
            </div>
            {EVENT_GROUPS.map((g) => {
              const kinds = g.kinds;
              const allOn = kinds.every((k) => events[k].inApp);
              return (
                <div key={g.key}>
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-border/60 bg-muted/30">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => setGroup(kinds, !allOn)}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {allOn ? "Turn group off" : "Turn group on"}
                      </button>
                      <button
                        onClick={() => muteGroup(kinds)}
                        className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Mute everywhere
                      </button>
                    </span>
                  </div>
                  {NOTIFICATION_EVENTS.filter((e) => kinds.includes(e.key)).map((e) => (
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
                      <div className="w-32 flex justify-end">
                        <select
                          value={modes[e.key]}
                          onChange={(ev) => setMode(e.key, ev.target.value as EmailMode)}
                          aria-label={`${e.label} email delivery`}
                          className="h-8 w-32 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {(["off", "immediate", "digest"] as EmailMode[]).map((m) => (
                            <option key={m} value={m}>{EMAIL_MODE_LABEL[m]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="quiet-hours" className="text-sm font-normal">Quiet hours</Label>
                <p className="text-[11px] text-muted-foreground">
                  In-app alerts always arrive instantly — quiet hours only hold emails back.
                </p>
              </div>
              <Switch
                id="quiet-hours"
                checked={quiet.enabled}
                onCheckedChange={(v) => setQuiet((q) => ({ ...q, enabled: v }))}
              />
            </div>
            <div className={cn("flex flex-wrap items-center gap-3", !quiet.enabled && "opacity-50 pointer-events-none")}>
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                From
                <Input
                  type="time"
                  className="h-8 w-28"
                  value={quiet.start}
                  onChange={(e) => setQuiet((q) => ({ ...q, start: e.target.value || q.start }))}
                />
              </label>
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                To
                <Input
                  type="time"
                  className="h-8 w-28"
                  value={quiet.end}
                  onChange={(e) => setQuiet((q) => ({ ...q, end: e.target.value || q.end }))}
                />
              </label>
              <span className="text-[11px] text-muted-foreground">{quiet.timeZone ?? localZone}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {quiet.enabled
                ? `Emails paused ${quiet.start}–${quiet.end} (${quiet.timeZone ?? localZone}) — held mail and daily digests arrive at ${quiet.end}.`
                : "Daily digests go out at 08:00 in your timezone."}
            </p>
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
