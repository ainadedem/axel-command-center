# Stop edit dialogs from resetting company, client and project

Editing a quotation or invoice sometimes snaps the Company, Client and Project selects back to the first available option. The cause is the auto-reconcile logic that runs on every options-list change.

## What is happening

Each dialog runs `useReconciledSelection` for company, client and project. When the saved value is not found in the currently loaded option list, the hook rewrites the selection to the first option. During background hydration the lists are rebuilt (partially at first, and clients are filtered by `contactBelongsTo`), so a saved client that is momentarily absent — or attached to the company through a legacy link — gets replaced. The project then clears because its parent changed, and the company can shift the same way.

## Fix

- In edit mode, never auto-switch a selection. Keep the value stored on the document even when it is not in the loaded list; only clear it if the user changes it.
- Render the saved company/client/project as an option in its select when it is missing from the list, so the field still shows the correct name instead of an empty control.
- Keep the reconcile-to-first behaviour only for brand-new documents, where there is no saved value to protect.
- Do not reconcile while the underlying lists are still loading or incomplete (extend the current `loading` guard beyond "array is empty").

## Scope

- `src/hooks/use-reconciled-selection.ts`: add a mode that preserves the current value instead of falling back to the first option.
- `src/routes/_authenticated/quotations.tsx`, `invoices.tsx`, `purchase-orders.tsx`: use preserve mode when `editing` is set, and include the saved record's company/client/project in the select options when missing.
- Other pages using the hook (projects, expenses, billing, payroll, transactions) stay unchanged.

## Verification

Open an existing Logia quotation and an existing invoice, leave the dialog open through a background refresh, and confirm the company, client and project stay exactly as saved and save unchanged.
