/**
 * Copy-paste follow-up messages for the Day 30 and Day 45 rungs of the
 * SOP-OPS-FIN-002 escalation ladder. Every sentence is built from the
 * invoice's real state, including what documentation is still missing.
 */

import { format, parseISO, addDays } from "date-fns";
import { fmtAmount, type Invoice, type Client, type Company, type PurchaseOrder, type PvrRecord } from "@/lib/mock-data";
import { agingDays, agingStart } from "@/lib/sop";

export type FollowUpLang = "en" | "fr";

export interface FollowUpInput {
  invoice: Invoice;
  client?: Client;
  company?: Company;
  po?: PurchaseOrder;
  pvrs: PvrRecord[];
  stage: number;
  lang: FollowUpLang;
  senderName?: string;
  today?: Date;
}

export interface FollowUpDraft {
  subject: string;
  body: string;
  /** Documentation gaps on our side — fix before sending. */
  gaps: string[];
}

const d = (iso?: string) => (iso ? format(parseISO(iso), "d MMMM yyyy") : "—");

export function buildFollowUp(input: FollowUpInput): FollowUpDraft {
  const { invoice, client, company, po, pvrs, stage, lang } = input;
  const today = input.today ?? new Date();
  const days = agingDays(invoice, today);
  const balance = fmtAmount(invoice.amount - invoice.paid, invoice.currency);
  const ingested = d(agingStart(invoice));
  const deadline = format(addDays(today, 7), "d MMMM yyyy");
  const signer = input.senderName || company?.name || "";
  const clientName = client?.name ?? "";
  const fr = lang === "fr";

  const gaps: string[] = [];
  if (!invoice.poId && !invoice.poWaived) gaps.push(fr ? "Aucun bon de commande client enregistré" : "No client purchase order recorded");
  if (po && !po.buyingEntity) gaps.push(fr ? "Entité juridique acheteuse non renseignée sur le BC" : "Buying legal entity missing on the PO");
  const linked = pvrs.filter((p) => p.invoiceId === invoice.id);
  if (linked.length === 0) gaps.push(fr ? "Aucun PV de réception signé joint" : "No signed completion certificate (PVR / JCC) attached");
  else if (!linked.some((p) => p.completionPct >= 100)) {
    const best = Math.max(...linked.map((p) => p.completionPct));
    gaps.push(fr ? `PV de réception à ${best}% seulement` : `Completion certificate only at ${best}%`);
  }
  if (!invoice.handoverProofUrl) gaps.push(fr ? "Décharge tamponnée non archivée" : "Stamped handover proof not archived");
  if (!invoice.ingestionDate) gaps.push(fr ? "Date d'entrée chez le client non enregistrée" : "Client ingestion date not recorded");

  const attached: string[] = [];
  if (po?.clientReference || po?.number) attached.push(fr ? `bon de commande ${po.clientReference || po.number}` : `purchase order ${po.clientReference || po.number}`);
  if (linked.some((p) => p.completionPct >= 100)) attached.push(fr ? "PV de réception signé à 100%" : "completion certificate signed at 100%");
  if (invoice.handoverProofUrl) attached.push(fr ? "décharge tamponnée du service courrier" : "stamped receiving-desk handover proof");

  if (stage >= 45) {
    const subject = fr
      ? `Relance formelle — facture ${invoice.number} (${balance}), ${days} jours`
      : `Formal reminder — invoice ${invoice.number} (${balance}), ${days} days outstanding`;
    const body = fr
      ? [
          `Objet : relance formelle — facture ${invoice.number}`,
          "",
          `Madame, Monsieur,`,
          "",
          `Sauf erreur de notre part, la facture ${invoice.number} d'un montant de ${balance}, entrée dans votre système le ${ingested}, demeure impayée à ce jour, soit ${days} jours.`,
          attached.length
            ? `Pour rappel, le dossier est complet : ${attached.join(", ")}. Ces pièces sont jointes à la présente.`
            : `Nous restons à votre disposition pour vous transmettre toute pièce justificative nécessaire au traitement.`,
          "",
          `Nous vous saurions gré de bien vouloir nous communiquer la date de règlement effective d'ici au ${deadline}. À défaut, le dossier sera transmis à la direction conformément à notre procédure interne de recouvrement.`,
          "",
          `Nous vous remercions par avance de votre diligence.`,
          "",
          `Cordialement,`,
          signer,
        ].join("\n")
      : [
          `Subject: Formal reminder — invoice ${invoice.number}`,
          "",
          `Dear ${clientName || "Sir or Madam"},`,
          "",
          `Our records show that invoice ${invoice.number} for ${balance}, which entered your processing system on ${ingested}, remains unpaid — ${days} days outstanding.`,
          attached.length
            ? `The supporting file is complete: ${attached.join(", ")}. These documents are attached to this message.`
            : `We remain available to supply any supporting document required to process the payment.`,
          "",
          `We would be grateful for a confirmed settlement date by ${deadline}. Failing that, the file will be escalated to executive sponsors in line with our internal collection procedure.`,
          "",
          `Thank you in advance for your attention to this matter.`,
          "",
          `Kind regards,`,
          signer,
        ].join("\n");
    return { subject, body, gaps };
  }

  const subject = fr
    ? `Suivi — facture ${invoice.number} (${balance})`
    : `Follow-up — invoice ${invoice.number} (${balance})`;
  const body = fr
    ? [
        `Objet : suivi de la facture ${invoice.number}`,
        "",
        `Bonjour,`,
        "",
        `Nous revenons vers vous au sujet de la facture ${invoice.number} d'un montant de ${balance}, enregistrée chez vous le ${ingested} (${days} jours).`,
        `Pourriez-vous nous confirmer qu'elle est bien ordonnancée et nous indiquer la date de règlement prévue ?`,
        attached.length ? `Le dossier comprend : ${attached.join(", ")}.` : "",
        "",
        `Merci beaucoup pour votre retour.`,
        "",
        `Bien cordialement,`,
        signer,
      ].filter(Boolean).join("\n")
    : [
        `Subject: Follow-up on invoice ${invoice.number}`,
        "",
        `Hello,`,
        "",
        `I am following up on invoice ${invoice.number} for ${balance}, booked on your side on ${ingested} (${days} days ago).`,
        `Could you confirm that it has been scheduled for payment and share the expected settlement date?`,
        attached.length ? `For reference, the file includes: ${attached.join(", ")}.` : "",
        "",
        `Many thanks for your help.`,
        "",
        `Best regards,`,
        signer,
      ].filter(Boolean).join("\n");

  return { subject, body, gaps };
}
