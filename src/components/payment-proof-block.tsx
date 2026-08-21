/**
 * "Payment proof" block shown in the invoice detail panel: the evidence chain
 * behind a payment — quotation, client PO, bank transaction — with an explicit
 * verdict and links to each source record.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, FileCheck2, Landmark, ExternalLink, Search, History, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        proof.installments.map((it, idx) => (
          <div key={it.transaction.id} className="group/pay relative">
            <button
              type="button"
              aria-label="Unlink this payment"
              title="Unlink this payment"
              onClick={() => setUnlinking(it.transaction)}
              className="absolute right-1 top-1.5 z-10 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/pay:opacity-100"
            >
              <Unlink className="h-3.5 w-3.5" />
            </button>
            <Row
              icon={<Landmark className="h-4 w-4" />}
              label={proof.installments.length > 1 ? `Payment ${idx + 1}` : "Payment"}
              primary={`${it.transaction.date} · ${it.transaction.description}`}
              secondary={money(it.transaction.amount, it.transaction.currency)}
              href={{ to: "/transactions", search: { q: it.transaction.description.slice(0, 40) } }}
            />
            {proof.installments.length > 1 && (
              <p className="pl-[7.1rem] text-[11px] text-muted-foreground">
                covered {money(it.runningCovered, invoice.currency)} · remaining{" "}
                {money(it.remainingAfter, invoice.currency)}
              </p>
            )}
          </div>
        ))
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
    </section>
  );
}

/** Who confirmed each payment match, and on what evidence. */
function VerificationHistory({ invoiceId }: { invoiceId: string }) {
  const { entries } = usePaymentAudit(invoiceId);
  const [open, setOpen] = useState(false);
  const { ownerName } = useOwnerNames(entries.map((e) => e.actorId));
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
        <ul className="mt-1.5 space-y-1.5">
          {entries.map((e) => (
            <li key={e.id} className="text-xs">
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
