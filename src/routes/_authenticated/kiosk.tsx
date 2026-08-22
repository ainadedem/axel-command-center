import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Delete, ArrowLeft, Loader2 } from "lucide-react";
import { Avatar } from "@/components/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/company-context";
import { toDbCompany, useCompanyMembers } from "@/lib/time-attendance";
import { kioskPunch } from "@/lib/kiosk.functions";
import { fmtDuration } from "@/lib/time-calc";

export const Route = createFileRoute("/_authenticated/kiosk")({ component: KioskPage });

function KioskPage() {
  const { scope, accessibleCompanies, label } = useCompany();
  const companyDbId = useMemo(() => {
    const local = scope.id === "company" ? scope.companyId : accessibleCompanies[0]?.id;
    return local ? toDbCompany(local) : undefined;
  }, [scope, accessibleCompanies]);

  const { members } = useCompanyMembers(companyDbId ? [companyDbId] : []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const person = members.find((m) => m.userId === selected);
  const list = members.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()));

  const reset = () => { setSelected(null); setPin(""); setSearch(""); };

  const punch = async () => {
    if (!companyDbId || !selected || pin.length < 4) return;
    setBusy(true);
    try {
      const res = await kioskPunch({ data: { companyId: companyDbId, employeeId: selected, pin } });
      toast.success(
        res.action === "in"
          ? `${person?.name ?? "Welcome"} — clocked in`
          : `${person?.name ?? "Goodbye"} — clocked out after ${fmtDuration(res.minutes)}`,
      );
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record the punch");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const key = (d: string) => setPin((p) => (p.length >= 8 ? p : p + d));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16 space-y-8">
        <header className="flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="rounded-full gap-1.5">
            <Link to="/time"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <div className="flex-1 text-right">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <h1 className="font-display text-xl">Attendance kiosk</h1>
          </div>
        </header>

        {!person ? (
          <section className="rounded-3xl bg-[var(--surface-container)] p-6 space-y-4">
            <Input
              className="h-11 rounded-full"
              placeholder="Search your name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {list.map((m) => (
                <button key={m.userId} onClick={() => setSelected(m.userId)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-surface/60 hover:bg-surface transition text-left">
                  <Avatar src={m.avatarUrl ?? undefined} name={m.name} size={36} />
                  <span className="truncate text-sm">{m.name}</span>
                </button>
              ))}
              {list.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center col-span-full">No one found.</p>}
            </div>
          </section>
        ) : (
          <section className="rounded-3xl bg-[var(--surface-container)] p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Avatar src={person.avatarUrl ?? undefined} name={person.name} size={44} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{person.name}</div>
                <div className="text-[11px] text-muted-foreground">Enter your PIN to clock in or out</div>
              </div>
              <Button size="sm" variant="ghost" onClick={reset}>Change</Button>
            </div>

            <div className="flex justify-center gap-2">
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                <span key={i} className={cn("h-3 w-3 rounded-full", i < pin.length ? "bg-primary" : "bg-muted")} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} onClick={() => key(d)}
                  className="h-16 rounded-2xl bg-surface/70 hover:bg-surface text-xl font-tnum transition active:scale-[0.97]">{d}</button>
              ))}
              <button onClick={() => setPin("")} className="h-16 rounded-2xl bg-surface/40 text-xs text-muted-foreground">Clear</button>
              <button onClick={() => key("0")} className="h-16 rounded-2xl bg-surface/70 hover:bg-surface text-xl font-tnum transition active:scale-[0.97]">0</button>
              <button onClick={() => setPin((p) => p.slice(0, -1))} className="h-16 rounded-2xl bg-surface/40 grid place-items-center text-muted-foreground">
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <Button className="w-full h-12 rounded-full" disabled={busy || pin.length < 4} onClick={() => void punch()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Clock in / out"}
            </Button>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Shared device · Madagascar time (UTC+3). PINs are managed in Time &amp; Attendance settings.
        </p>
      </div>
    </div>
  );
}
