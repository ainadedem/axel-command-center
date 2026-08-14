# Sales: read-only on existing clients

Sales users may keep adding new clients/leads, but can no longer change or delete an existing client. Enforced both in the interface and in the database, so it holds even outside the app screens.

## What changes for a sales user

- Client list and detail cards: edit (pencil) and delete (trash) buttons are hidden.
- The client form opens in view-only mode when reached from an existing client (fields disabled, no Save).
- "New client" / "New lead" stays available, including the header New button.
- Everyone else (company admin, manager, project manager, finance) is unaffected.

## Technical notes

- `src/routes/_authenticated/clients.tsx`: derive `canEditClients = !isSalesOnly` from `useEffectiveRole()` (respect `roleResolved` before hiding anything). Gate the row/card edit and delete buttons, and the edit path in the client dialog; keep the create path open for sales.
- Database migration on `public.clients`: keep `sales` in the INSERT policy, remove `sales` from the UPDATE and DELETE policies (leaving `company_admin`, `manager`, `project_manager`).
- No schema or data changes; no other table touched.
