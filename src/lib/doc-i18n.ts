/**
 * Bilingual labels for printed documents (invoices, quotes, purchase orders).
 * French is the default working language for Malagasy entities, English is used
 * for international clients — the language is stored per document.
 */
export type DocLanguage = "en" | "fr";

export const DOC_LANGUAGES: { value: DocLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

export const isDocLanguage = (v: unknown): v is DocLanguage => v === "en" || v === "fr";

type Labels = {
  invoice: string;
  quote: string;
  po: string;
  object: string;
  issued: string;
  due: string;
  validUntil: string;
  paid: string;
  clientRef: string;
  from: string;
  billTo: string;
  issuedBy: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  subtotal: string;
  vat: string;
  total: string;
  paidToDate: string;
  balanceDue: string;
  notes: string;
  paymentTitle: string;
  bankWire: string;
  mobileMoney: string;
  paymentRef: (n: string) => string;
  amountInWords: (words: string) => string;
  footerInvoice: (n: string) => string;
  footerQuote: (n: string, due: string) => string;
  footerPo: (n: string) => string;
  project: string;
  services: string;
};

const en: Labels = {
  invoice: "INVOICE",
  quote: "QUOTATION",
  po: "PURCHASE ORDER",
  object: "Object",
  issued: "Issued",
  due: "Due",
  validUntil: "Valid until",
  paid: "Paid",
  clientRef: "Client ref",
  from: "From",
  billTo: "Bill to",
  issuedBy: "Issued by",
  description: "Description",
  quantity: "Quantity",
  unit: "Unit",
  unitPrice: "Unit price",
  lineTotal: "Total",
  subtotal: "Subtotal",
  vat: "VAT",
  total: "Total",
  paidToDate: "Paid to date",
  balanceDue: "Balance due",
  notes: "Notes",
  paymentTitle: "Payment terms & bank details",
  bankWire: "Bank wire",
  mobileMoney: "Mobile money",
  paymentRef: (n) => `Please mention ${n} as the transfer reference.`,
  amountInWords: (w) => `Total amount in words: ${w}.`,
  footerInvoice: (n) => `Thank you for your business. Please reference ${n} on any payment.`,
  footerQuote: (n, due) => `This quotation is valid until ${due}. Accept by issuing a purchase order referencing ${n}.`,
  footerPo: (n) => `Please confirm receipt of this purchase order and reference ${n} on the corresponding invoice.`,
  project: "Project",
  services: "Professional services",
};

const fr: Labels = {
  invoice: "FACTURE",
  quote: "DEVIS",
  po: "BON DE COMMANDE",
  object: "Objet",
  issued: "Date",
  due: "Échéance",
  validUntil: "Valable jusqu'au",
  paid: "Payée le",
  clientRef: "Réf. client",
  from: "Émetteur",
  billTo: "Facturé à",
  issuedBy: "Émis par",
  description: "Désignation",
  quantity: "Qté",
  unit: "Unité",
  unitPrice: "Prix unitaire HT",
  lineTotal: "Total HT",
  subtotal: "Total HT",
  vat: "TVA",
  total: "Total TTC",
  paidToDate: "Déjà réglé",
  balanceDue: "Reste à payer",
  notes: "Observations",
  paymentTitle: "Conditions de paiement & coordonnées bancaires",
  bankWire: "Virement bancaire",
  mobileMoney: "Mobile money",
  paymentRef: (n) => `Merci d'indiquer la référence ${n} lors du virement.`,
  amountInWords: (w) => `Arrêté à la somme de ${w}.`,
  footerInvoice: (n) => `Merci de votre confiance. Merci de rappeler la référence ${n} lors du règlement.`,
  footerQuote: (n, due) => `Ce devis est valable jusqu'au ${due}. Pour l'accepter, merci d'émettre un bon de commande référençant ${n}.`,
  footerPo: (n) => `Merci de confirmer la réception de ce bon de commande et de rappeler la référence ${n} sur la facture correspondante.`,
  project: "Projet",
  services: "Prestations de services",
};

export const docLabels = (lang: DocLanguage | undefined): Labels => (lang === "fr" ? fr : en);

/** Date format token pair per language, used with date-fns. */
export const docDateFormat = (lang: DocLanguage | undefined) => (lang === "fr" ? "dd/MM/yyyy" : "MMM d, yyyy");
