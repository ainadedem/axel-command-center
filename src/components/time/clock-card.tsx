import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Camera, MapPin, Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clockIn, clockOut } from "@/lib/time-attendance";
import { entryMinutes, fmtDuration, hhmm, type TimeEntry } from "@/lib/time-calc";
import { uploadFile, AVATARS_BUCKET } from "@/lib/storage";

/** Ticking elapsed counter for the open shift. */
function useTicker(active: boolean) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [active]);
}

async function captureSelfie(): Promise<File | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480 } });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 350));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (!blob) return null;
    return new File([blob], "clock-in.jpg", { type: "image/jpeg" });
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 60_000 },
    );
  });
}

export function ClockCard({
  companyId,
  employeeId,
  openEntry,
  todayMinutes,
  projects,
  onChanged,
}: {
  companyId?: string;
  employeeId?: string;
  openEntry?: TimeEntry;
  todayMinutes: number;
  projects: { id: string; name: string }[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [withPhoto, setWithPhoto] = useState(false);
  const [withGps, setWithGps] = useState(false);
  const [projectId, setProjectId] = useState<string>("none");
  const [activity, setActivity] = useState("");
  const [billable, setBillable] = useState(false);
  const guard = useRef(false);
  useTicker(!!openEntry);

  const elapsed = openEntry ? entryMinutes(openEntry) : 0;
  const running = !!openEntry;
  const total = useMemo(() => todayMinutes, [todayMinutes]);

  const punch = async () => {
    if (guard.current || !companyId || !employeeId) return;
    guard.current = true;
    setBusy(true);
    try {
      if (running && openEntry) {
        await clockOut(openEntry);
        toast.success(`Clocked out — ${fmtDuration(entryMinutes(openEntry))} on this shift`);
      } else {
        let photoUrl: string | null = null;
        if (withPhoto) {
          try {
            const file = await captureSelfie();
            if (file) photoUrl = await uploadFile(AVATARS_BUCKET, "attendance", file);
          } catch {
            toast.message("Camera unavailable — clocking in without a photo");
          }
        }
        const gps = withGps ? await getPosition() : null;
        await clockIn({
          companyId,
          employeeId,
          method: "web",
          projectId: projectId === "none" ? null : projectId,
          activity: activity.trim() || null,
          billable,
          photoUrl,
          gps,
        });
        toast.success("Clocked in");
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the punch");
    } finally {
      setBusy(false);
      guard.current = false;
    }
  };

  return (
    <section className="rounded-3xl bg-[var(--surface-container)] p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
        <button
          type="button"
          onClick={() => void punch()}
          disabled={busy || !companyId || !employeeId}
          className={cn(
            "h-32 w-32 shrink-0 rounded-full grid place-items-center transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            "active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
            running
              ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "bg-primary text-primary-foreground hover:brightness-105 shadow-[var(--shadow-elevated)]",
          )}
        >
          {busy ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <span className="flex flex-col items-center gap-1.5">
              {running ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              <span className="text-xs tracking-wide uppercase">{running ? "Clock out" : "Clock in"}</span>
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-display tracking-tight font-tnum">
              {running ? fmtDuration(elapsed) : fmtDuration(total)}
            </div>
            <div className="text-sm text-muted-foreground">
              {running ? `since ${hhmm(openEntry!.clockIn)}` : "worked today"}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {running
              ? `Today's total so far ${fmtDuration(total)} · Antananarivo time`
              : "You are clocked out · Antananarivo time"}
          </div>

          {!running && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 rounded-full text-xs"><SelectValue placeholder="Project (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="h-9 rounded-full text-xs"
                placeholder="Activity (optional)"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Switch checked={withPhoto} onCheckedChange={setWithPhoto} /> <Camera className="h-3.5 w-3.5" /> Selfie
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Switch checked={withGps} onCheckedChange={setWithGps} /> <MapPin className="h-3.5 w-3.5" /> Location
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <Switch checked={billable} onCheckedChange={setBillable} /> <Clock className="h-3.5 w-3.5" /> Billable
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ClockActionsHint() {
  return (
    <p className="text-xs text-muted-foreground px-1">
      Times are recorded in Madagascar time (UTC+3). Selfie and location are optional and stored with the entry for audit.
    </p>
  );
}

export { Button };
