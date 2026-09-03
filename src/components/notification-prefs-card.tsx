import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
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

export function NotificationPrefsCard() {
  const { user } = useAuth() as { user?: { id?: string } | null };
  const userId = user?.id;
  const [enabled, setEnabled] = useState(true);
  const [stages, setStages] = useState<number[]>([...STAGES]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("notification_prefs")
      .select("ar_alerts_enabled, stages")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setEnabled(data.ar_alerts_enabled as boolean);
          setStages((data.stages as number[]) ?? [...STAGES]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const toggleStage = (s: number) =>
    setStages((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].sort((a, b) => a - b)));

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert({ user_id: userId, ar_alerts_enabled: enabled, stages }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Notification preferences saved.");
  };

  return (
    <section className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 space-y-4">
      <header className="space-y-1">
        <h2 className="font-display t-subtitle font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Receivables alerts
        </h2>
        <p className="t-label text-muted-foreground">
          Get an email the day an invoice crosses a step of the collection ladder. One message per invoice and step — never a repeat.
        </p>
      </header>

      {loading ? (
        <div className="t-body text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ar-alerts" className="t-body font-normal">Email me when an invoice reaches a new step</Label>
            <Switch id="ar-alerts" checked={enabled} onCheckedChange={setEnabled} aria-label="Enable receivables alerts" />
          </div>

          <div className={cn("space-y-2", !enabled && "opacity-50 pointer-events-none")}>
            <div className="t-label uppercase tracking-wider text-muted-foreground">Steps to be alerted on</div>
            <div className="flex flex-wrap gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStage(s)}
                  aria-pressed={stages.includes(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border t-label transition-all press-scale text-left",
                    stages.includes(s)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="font-medium">Day {s}</span>
                  <span className="block t-micro opacity-80">{STAGE_HINT[s]}</span>
                </button>
              ))}
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
