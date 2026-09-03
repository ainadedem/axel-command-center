import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  classNames,
  customAccountsStore,
  pcgIndex,
  useAllPcgAccounts,
  type PcgAccount,
  type PcgClass,
  type PcgNature,
} from "@/lib/pcg";
import { newId } from "@/lib/data-store";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/plan-comptable")({ component: PlanComptablePage });

const natures: PcgNature[] = ["actif", "passif", "charge", "produit"];

function PlanComptablePage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const accounts = useAllPcgAccounts();
  const { canSeeFinance } = useEffectiveRole();
  const custom = new Set(customAccountsStore.items.map((a) => a.code));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? accounts.filter((a) => a.code.startsWith(q) || a.name.toLowerCase().includes(q))
    : accounts;

  const byClass = new Map<PcgClass, PcgAccount[]>();
  filtered.forEach((a) => {
    if (!byClass.has(a.class)) byClass.set(a.class, []);
    byClass.get(a.class)!.push(a);
  });

  return (
    <AppShell>
      <PageHeader
        title="Plan comptable"
        description="PCG Madagascar 2005 — cohérent avec les normes IAS/IFRS. Décret n°2004-272."
        actions={
          canSeeFinance ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Nouveau sous-compte
            </Button>
          ) : undefined
        }
      />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Recherche par code ou libellé (ex. 411, TVA, salaires)…"
          className="w-full max-w-md h-10 px-3 rounded-md bg-surface border border-border t-body focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {([1, 2, 3, 4, 5, 6, 7] as PcgClass[]).map((cls) => {
          const list = byClass.get(cls);
          if (!list?.length) return null;
          return (
            <div key={cls} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="t-label uppercase tracking-[0.16em] text-muted-foreground">Classe {cls}</div>
                  <div className="font-display t-title font-semibold">{classNames[cls]}</div>
                </div>
                <div className="t-label text-muted-foreground">{list.length} comptes</div>
              </div>
              <div className="overflow-x-auto sticky-first-col">
              <table className="sheet sheet-pin1 w-full min-w-[900px] t-body">
                <thead>
                  <tr className="t-label uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-5 py-2 w-28">Code</th>
                    <th className="text-left font-medium px-5 py-2">Libellé</th>
                    <th className="text-left font-medium px-5 py-2 w-32">Nature</th>
                    <th className="text-right font-medium px-5 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.code} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/50">
                      <td className="px-5 py-2.5 font-tnum">
                        <span className={a.parent ? "text-muted-foreground pl-4" : "font-semibold"}>{a.code}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        {a.name}
                        {custom.has(a.code) && (
                          <span className="ml-2 t-micro uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">
                            personnalisé
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 t-label uppercase tracking-wider text-muted-foreground">{a.nature}</td>
                      <td className="px-5 py-2.5 text-right">
                        {canSeeFinance && custom.has(a.code) && (
                          <button
                            type="button"
                            title="Supprimer ce sous-compte"
                            onClick={() => {
                              const row = customAccountsStore.items.find((c) => c.code === a.code);
                              if (!row) return;
                              customAccountsStore.remove(row.id);
                              toast.success(`Sous-compte ${a.code} supprimé`);
                            }}
                            className="h-7 w-7 inline-grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          );
        })}
      </div>
      {canSeeFinance && <SubAccountDialog open={open} onOpenChange={setOpen} />}
    </AppShell>
  );
}

function SubAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nature, setNature] = useState<PcgNature>("charge");

  const trimmed = code.trim();
  const cls = Number(trimmed[0]);
  const validClass = cls >= 1 && cls <= 7;
  const parent = (() => {
    for (let n = Math.min(trimmed.length - 1, 5); n >= 2; n--) {
      if (pcgIndex.has(trimmed.slice(0, n))) return trimmed.slice(0, n);
    }
    return undefined;
  })();
  const duplicate =
    !!trimmed &&
    (pcgIndex.has(trimmed) || customAccountsStore.items.some((a) => a.code === trimmed));
  const valid =
    /^\d{3,10}$/.test(trimmed) && validClass && !!name.trim() && !duplicate;

  const submit = () => {
    if (!valid) return;
    customAccountsStore.add({
      id: newId("pcgacc"),
      code: trimmed,
      name: name.trim(),
      class: cls as PcgClass,
      nature,
      parent,
      createdAt: new Date().toISOString(),
      createdBy: user?.id,
    });
    toast.success(`Sous-compte ${trimmed} créé`);
    setCode(""); setName(""); setNature("charge");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau sous-compte</DialogTitle>
          <DialogDescription>
            Ajoutez une subdivision au plan comptable. Elle sera disponible dans le journal, la balance et le grand-livre.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label>Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="ex. 622690"
              className="font-tnum"
            />
            {trimmed && duplicate && (
              <p className="t-label text-destructive mt-1">Ce code existe déjà.</p>
            )}
            {trimmed && !duplicate && !/^\d{3,10}$/.test(trimmed) && (
              <p className="t-label text-destructive mt-1">Le code doit contenir au moins 3 chiffres.</p>
            )}
            {trimmed && !duplicate && validClass && (
              <p className="t-label text-muted-foreground mt-1">
                Classe {cls} · {classNames[cls as PcgClass]}
                {parent ? ` · rattaché à ${parent} — ${pcgIndex.get(parent)?.name}` : ""}
              </p>
            )}
          </div>
          <div>
            <Label>Libellé</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Honoraires production" />
          </div>
          <div>
            <Label>Nature</Label>
            <Select value={nature} onValueChange={(v) => setNature(v as PcgNature)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {natures.map((n) => (
                  <SelectItem key={n} value={n} className="capitalize">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!valid}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
