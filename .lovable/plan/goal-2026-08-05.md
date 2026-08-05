Add French amount-in-words line to invoice PDF/preview

## Goal
Display the classic French legal mention **"Arrêté à la somme de ..."** on invoice previews and PDFs, just below the Total TTC.

## Implementation

1. **Create `src/lib/amount-words.ts`**
   - Add a pure function `amountInFrench(amount: number, currency: Currency): string` that spells the integer part in French.
   - Support the three app currencies:
     - MGA: no decimal (Ariary)
     - EUR / USD: two decimals (e.g., "quarante-deux euros et trente-cinq centimes")
   - Handle thousands, millions, and the French 70/80/90 conventions.

2. **Update `src/components/document-preview.tsx`**
   - Inside the invoice totals block, add a new line under the Total TTC that prints:  
     `Arrêté à la somme de ${amountInFrench(totalTTC, doc.currency)}.`
   - Use a small italic/gray style so it remains formal but unobtrusive.
   - Keep it scoped to `doc.kind === "invoice"`.

3. **Verify**
   - Run a type-check to ensure the new utility and JSX changes compile.

## Out of scope
- Quotes and purchase orders (only the invoice will carry this mention unless requested later).
- Changing the invoice builder UI; this is a rendering-only change.
