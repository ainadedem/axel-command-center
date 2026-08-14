import { useMemo, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { Phone, Mail, Users, StickyNote, Plus, Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { newId } from "@/lib/data-store";
import {
  quoteFollowupsStore, quotesStore, useQuoteFollowups,
  type Quote, type QuoteFollowupKind,
} from "@/lib/mock-data";
import { useAuth } from "@/lib/auth-context";
import { useOwnerNames } from "@/hooks/use-owner-names";
import { cn } from "@/lib/utils";

const KINDS: { value: QuoteFollowupKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "call", label: "Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "note", label: "Note", icon: StickyNote },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Colour-codes the next follow-up date: overdue red, today amber, later neutral. */
export function followUpTone(date?: string): "overdue" | "today" | "upcoming" | "none" {
  if (!date) return "none";
  const d = parseISO(date);
  if (!isValid(d)) return "none";
  const t = today();
  if (date < t) return "overdue";
  if (date === t) return "today";
  return "upcoming";
}

export const followUpToneClass: Record<"overdue" | "today" | "upcoming" | "none", string> = {
  overdue: "border-destructive/40 text-destructive bg-destructive/10",
  today: "border-warning/40 text-warning bg-warning/10",
  upcoming: "border-border text-muted-foreground bg-muted/30",
  none: "border-border text-muted-foreground/60 bg-transparent",
};

export function QuoteFollowupPanel({ quote }: { quote: Quote }) {
  const all = useQuoteFollowups();
  const { user } = useAuth();
  const entries = useMemo(
    () => all.filter((f) => f.quoteId === quote.id).sort((a, b) => b.happenedAt.localeCompare(a.happenedAt)),
    [all, quote.id],
  );
  const { ownerName } = useOwnerNames(entries.map((e) => e.createdBy));

  const [kind, setKind] = useState<QuoteFollowupKind>("call");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(today());
  const [next, setNext] = useState(quote.nextFollowUpAt ?? "");

  const add = () => {
    if (!note.trim()) return;
    quoteFollowupsStore.add({
      id: newId("qf"),
      companyId: quote.companyId,
      quoteId: quote.id,
      kind,
      note: note.trim(),
      happenedAt: new Date(`${when}T12:00:00`).toISOString(),
      createdBy: user?.id,
    });
    setNote("");
  };

  const saveNext = (value: string) => {
    setNext(value);
    quotesStore.update(quote.id, { nextFollowUpAt: value || undefined });
  };

  const tone = followUpTone(next || undefined);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[9rem]">
            <Label className="text-[11px]">Next follow-up</Label>
            <Input type="date" value={next} onChange={(e) => saveNext(e.target.value)} />
          </div>
          <span className={cn("text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border inline-flex items-center gap-1", followUpToneClass[tone])}>
            <CalendarClock className="h-3 w-3" />
            {tone === "overdue" ? "Overdue" : tone === "today" ? "Due today" : tone === "upcoming" ? "Scheduled" : "Not scheduled"}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[10rem_10rem] gap-3">
          <div>
            <Label className="text-[11px]">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as QuoteFollowupKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Date</Label>
            <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-[11px]">What happened</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called the client, waiting on budget confirmation…" />
        </div>
        <Button size="sm" onClick={add} disabled={!note.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Log follow-up
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No follow-up logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const meta = KINDS.find((k) => k.value === e.kind) ?? KINDS[3];
            const Icon = meta.icon;
            const mine = e.createdBy && user?.id === e.createdBy;
            return (
              <li key={e.id} className="flex gap-3 rounded-lg border border-border/60 p-3 group">
                <span className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="uppercase tracking-wider">{meta.label}</span>
                    <span>·</span>
                    <span className="font-tnum">{format(parseISO(e.happenedAt), "MMM d, yyyy")}</span>
                    {ownerName(e.createdBy) && <><span>·</span><span>{ownerName(e.createdBy)}</span></>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words mt-0.5">{e.note}</p>
                </div>
                {mine && (
                  <button
                    aria-label="Delete follow-up"
                    onClick={() => quoteFollowupsStore.remove(e.id)}
                    className="h-7 w-7 grid place-items-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
