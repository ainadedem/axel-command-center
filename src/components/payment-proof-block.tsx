/**
 * "Payment proof" block shown in the invoice detail panel: the evidence chain
 * behind a payment — quotation, client PO, bank transaction — with an explicit
 * verdict and links to each source record.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, FileCheck2, Landmark, ExternalLink, Search, History, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VerifiedBadge } from "@/components/status-badge";
import {
  fmtFull,
  useTransactions,
  useQuotes,
  usePurchaseOrders,
  type Invoice,
  type Currency,
} from "@/lib/mock-data";
const money = (v: number, c: string) => fmtFull(v, c as Currency);

import { buildPaymentProof, badgeState, type ProofInvoice } from "@/lib/payment-proof";
import { usePaymentAudit, describeMatchedFields } from "@/lib/payment-audit";
import { useOwnerNames } from "@/hooks/use-owner-names";
import { PaymentMatchDialog } from "@/components/payment-match-dialog";
import { PaymentUnlinkDialog } from "@/components/payment-unlink-dialog";
import { useUnlinkPermission } from "@/lib/payment-permissions";
import type { ProofTransaction } from "@/lib/payment-proof";

function Row({
  icon,
  label,
  primary,
  secondary,
  href,
  missing,
}: {
  icon: React.ReactNode;
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  href?: { to: string; search?: Record<string, string> };
  missing?: boolean;
}) {
  const body = (
    <div className="flex min-w-0 items-center gap-2.5 py-1.5">
      <span className={missing ? "text-muted-foreground" : "text-primary"}>{icon}</span>
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 flex-1 truncate text-sm ${missing ? "text-muted-foreground italic" : ""}`}>
        {primary}
      </span>
      {secondary && <span className="shrink-0 font-tnum text-sm text-muted-foreground">{secondary}</span>}
      {href && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  );
  if (!href) return body;
  return (
    <Link
      to={href.to}
      search={href.search as never}
      className="block rounded-lg px-1 transition-colors hover:bg-[var(--surface-container)]"
    >
      {body}
    </Link>
  );
}

export function PaymentProofBlock({ invoice }: { invoice: Invoice }) {
  const transactions = useTransactions();
  const quotes = useQuotes();
  const pos = usePurchaseOrders();
  const [matching, setMatching] = useState(false);
  const [unlinking, setUnlinking] = useState<ProofTransaction | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkUnlink, setBulkUnlink] = useState(false);
  const canUnlink = useUnlinkPermission().can(invoice.companyId);

  const proof = useMemo(
    () =>
      buildPaymentProof(
        invoice as unknown as ProofInvoice,
        transactions as never,
        quotes as never,
        pos as never,
      ),
    [invoice, transactions, quotes, pos],
  );

  const multi = proof.installments.length > 1;

  if (proof.verification === "n/a") return null;

  return (
    <section className="rounded-2xl bg-[var(--surface-container)]/60 px-4 py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-[11px] tracking-[0.06em] text-muted-foreground">Payment proof</h3>
        <VerifiedBadge state={badgeState(proof.verification)} showLabel />
      </div>

      <Row
        icon={<FileText className="h-4 w-4" />}
        label="Quotation"
        primary={proof.quote ? `${proof.quote.number} · ${proof.quote.status}` : "No quotation linked"}
        secondary={proof.quote ? money(proof.quote.amount, proof.quote.currency) : undefined}
        href={proof.quote ? { to: "/quotations", search: { focus: proof.quote.id } } : undefined}
        missing={!proof.quote}
      />

      <Row
        icon={<FileCheck2 className="h-4 w-4" />}
        label="Client PO"
        primary={
          proof.po
            ? `${proof.po.number}${proof.po.documentName ? ` · ${proof.po.documentName}` : " · no file uploaded"}`
            : invoice.poWaived
              ? `PO bypassed${invoice.poWaiverReason ? ` — ${invoice.poWaiverReason}` : ""}`
              : "PO missing"
        }
        secondary={proof.po ? money(proof.po.amount, proof.po.currency) : undefined}
        href={proof.po ? { to: "/purchase-orders", search: { focus: proof.po.id } } : undefined}
        missing={!proof.po}
      />

      {proof.installments.length === 0 ? (
        <Row
          icon={<Landmark className="h-4 w-4" />}
          label="Payment"
          primary="No bank transaction linked"
          missing
        />
      ) : (
        <>
          {multi && canUnlink && (
            <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-1 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 hover:bg-[var(--surface-container)] hover:text-foreground"
                onClick={() =>
                  setPicked(
                    picked.length === proof.installments.length
                      ? []
                      : proof.installments.map((i) => i.transaction.id),
                  )
                }
              >
                {picked.length === proof.installments.length ? "Clear" : "Select all payments"}
              </button>
              {picked.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-xs text-destructive"
                  onClick={() => setBulkUnlink(true)}
                >
                  <Unlink className="h-3.5 w-3.5" /> Unlink {picked.length} payment
                  {picked.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          )}
          {proof.installments.map((it, idx) => (
            <div key={it.transaction.id} className="group/pay relative flex items-start gap-2">
              {multi && canUnlink && (
                <Checkbox
                  className="mt-2.5 shrink-0"
                  checked={picked.includes(it.transaction.id)}
                  onCheckedChange={() =>
                    setPicked((prev) =>
                      prev.includes(it.transaction.id)
                        ? prev.filter((id) => id !== it.transaction.id)
                        : [...prev, it.transaction.id],
                    )
                  }
                  aria-label={`Select payment ${idx + 1}`}
                />
              )}
              <div className="min-w-0 flex-1">
                {picked.length === 0 && canUnlink && (
                  <button
                    type="button"
                    aria-label="Unlink this payment"
                    title="Unlink this payment"
                    onClick={() => setUnlinking(it.transaction)}
                    className="absolute right-1 top-1.5 z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/pay:opacity-100"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                )}
                <Row
                  icon={<Landmark className="h-4 w-4" />}
                  label={multi ? `Payment ${idx + 1}` : "Payment"}
                  primary={`${it.transaction.date} · ${it.transaction.description}`}
                  secondary={money(it.transaction.amount, it.transaction.currency)}
                  href={{ to: "/transactions", search: { q: it.transaction.description.slice(0, 40) } }}
                />
                {multi && (
                  <p className="pl-[7.1rem] text-[11px] text-muted-foreground">
                    covered {money(it.runningCovered, invoice.currency)} · remaining{" "}
                    {money(it.remainingAfter, invoice.currency)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {proof.verification === "installment" && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-warning">
          <span>
            Part-paid: {money(proof.covered, invoice.currency)} of{" "}
            {money(proof.payable, invoice.currency)} matched — {money(proof.outstanding, invoice.currency)}{" "}
            still outstanding.
          </span>
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2" onClick={() => setMatching(true)}>
            <Search className="h-3.5 w-3.5" /> Find the next payment
          </Button>
        </div>
      )}

      {proof.verification !== "verified" && (
        <div className="mt-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMatching(true)}>
            <Search className="h-4 w-4" /> Find payment
          </Button>
        </div>
      )}

      <VerificationHistory invoiceId={invoice.id} />

      <PaymentMatchDialog
        open={matching}
        onOpenChange={setMatching}
        invoices={[invoice]}
      />

      {unlinking && (
        <PaymentUnlinkDialog
          open
          onOpenChange={(v) => !v && setUnlinking(null)}
          invoice={invoice}
          transaction={unlinking}
        />
      )}

      {bulkUnlink && picked.length > 0 && (
        <PaymentUnlinkDialog
          open
          onOpenChange={(v) => {
            if (!v) {
              setBulkUnlink(false);
              setPicked([]);
            }
          }}
          items={proof.installments
            .filter((it) => picked.includes(it.transaction.id))
            .map((it) => ({ invoice, transaction: it.transaction }))}
        />
      )}
    </section>
  );
}

/** Who confirmed each payment match, and on what evidence. */
function VerificationHistory({ invoiceId }: { invoiceId: string }) {
  const { entries } = usePaymentAudit(invoiceId);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const { ownerName } = useOwnerNames(entries.map((e) => e.actorId));

  // "View audit" on the unlink toast opens this invoice's history on the entry
  // that was just written.
  useEffect(() => {
    const onOpen = (ev: Event) => {
      const d = (ev as CustomEvent<{ docId?: string; entryId?: string }>).detail;
      if (d?.docId !== invoiceId) return;
      setOpen(true);
      setHighlight(d.entryId ?? null);
    };
    window.addEventListener("axel:open-activity", onOpen);
    return () => window.removeEventListener("axel:open-activity", onOpen);
  }, [invoiceId]);

  useEffect(() => {
    if (!highlight || !open) return;
    const el = listRef.current?.querySelector(`[data-entry="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(t);
  }, [highlight, open, entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <History className="h-3.5 w-3.5" />
        Verification history ({entries.length})
      </button>
      {open && (
        <ul ref={listRef} className="mt-1.5 space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              data-entry={e.id}
              className={`rounded-md text-xs transition-colors ${
                highlight === e.id ? "bg-primary/10 px-1.5 py-1 ring-1 ring-primary/40" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-foreground">{e.summary ?? e.action}</span>
                <span className="text-muted-foreground">
                  {ownerName(e.actorId) ?? "Unknown user"} ·{" "}
                  {new Date(e.createdAt).toLocaleString(undefined, {
                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              {describeMatchedFields(e.details) && (
                <div className="text-[11px] text-muted-foreground">{describeMatchedFields(e.details)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
