/**
 * "Payment proof" block shown in the invoice detail panel: the evidence chain
 * behind a payment — quotation, client PO, bank transaction — with an explicit
 * verdict and links to each source record.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, FileCheck2, Landmark, ExternalLink, Search } from "lucide-react";
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

import { buildPaymentProof, type ProofInvoice } from "@/lib/payment-proof";
import { PaymentMatchDialog } from "@/components/payment-match-dialog";

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
        <VerifiedBadge state={proof.verification} showLabel />
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

      {proof.payments.length === 0 ? (
        <Row
          icon={<Landmark className="h-4 w-4" />}
          label="Payment"
          primary="No bank transaction linked"
          missing
        />
      ) : (
        proof.payments.map((t) => (
          <Row
            key={t.id}
            icon={<Landmark className="h-4 w-4" />}
            label="Payment"
            primary={`${t.date} · ${t.description}`}
            secondary={money(t.amount, t.currency)}
            href={{ to: "/transactions", search: { q: t.description.slice(0, 40) } }}
          />
        ))
      )}

      {proof.verification === "partial" && (
        <p className="mt-1 text-xs text-warning">
          Shortfall of {money(proof.shortfall, invoice.currency)} between the recorded payment and the
          linked bank transactions.
        </p>
      )}

      {proof.verification !== "verified" && (
        <div className="mt-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMatching(true)}>
            <Search className="h-4 w-4" /> Find payment
          </Button>
        </div>
      )}

      <PaymentMatchDialog
        open={matching}
        onOpenChange={setMatching}
        invoices={[invoice]}
      />
    </section>
  );
}
