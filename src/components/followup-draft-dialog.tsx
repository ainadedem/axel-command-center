import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildFollowUp, type FollowUpLang } from "@/lib/ar-followup";
import type { Invoice, Client, Company, PurchaseOrder, PvrRecord } from "@/lib/mock-data";
import { Copy, AlertTriangle } from "lucide-react";

interface Props {
  target: { invoice: Invoice; stage: number } | null;
  onClose: () => void;
  clients: Client[];
  companies: Company[];
  purchaseOrders: PurchaseOrder[];
  pvrs: PvrRecord[];
  senderName?: string;
}

export function FollowUpDraftDialog({ target, onClose, clients, companies, purchaseOrders, pvrs, senderName }: Props) {
  const [lang, setLang] = useState<FollowUpLang>("en");

  const draft = useMemo(() => {
    if (!target) return null;
    const inv = target.invoice;
    return buildFollowUp({
      invoice: inv,
      client: clients.find((c) => c.id === inv.clientId),
      company: companies.find((c) => c.id === inv.companyId),
      po: purchaseOrders.find((p) => p.id === inv.poId),
      pvrs,
      stage: target.stage,
      lang,
      senderName,
    });
  }, [target, clients, companies, purchaseOrders, pvrs, lang, senderName]);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Could not access the clipboard — select the text and copy manually.");
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Day {target?.stage} follow-up — {target?.invoice.number}</DialogTitle>
          <DialogDescription>
            Written from this invoice's real state. Review, then copy into your email client.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="space-y-3">
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 w-fit">
              {(["en", "fr"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "px-3 py-1 rounded-md t-label uppercase tracking-wider transition-all",
                    lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l === "en" ? "English" : "Français"}
                </button>
              ))}
            </div>

            {draft.gaps.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-1">
                <div className="t-label font-medium text-warning flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Fix on our side before sending
                </div>
                <ul className="t-label text-muted-foreground space-y-0.5">
                  {draft.gaps.map((g) => <li key={g}>· {g}</li>)}
                </ul>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fu-subject">Subject</Label>
              <div className="flex gap-2">
                <Input id="fu-subject" readOnly value={draft.subject} />
                <Button variant="outline" size="icon" aria-label="Copy subject" onClick={() => copy(draft.subject, "Subject")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fu-body">Message</Label>
              <Textarea id="fu-body" readOnly value={draft.body} rows={16} className="font-mono t-label leading-relaxed" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {draft && (
            <Button onClick={() => copy(`${draft.subject}\n\n${draft.body}`, "Message")}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy message
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
