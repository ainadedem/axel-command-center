# Undo / Redo (last 5 actions)

Add app-wide undo and redo for data changes, keeping a history of the 5 most recent actions.

## What you get

- **Undo / Redo buttons** in the top header (arrow icons), next to the "New" button. Disabled when there is nothing to undo/redo, with a tooltip describing the action ("Undo delete invoice INV-0012").
- **Keyboard shortcuts**: Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) to redo.
- **Depth of 5**: only the last five changes are reversible; older ones drop off.
- **Toast confirmation** after each undo/redo, with a one-click "Redo"/"Undo" back.
- Works for creating, editing and deleting records across the app: invoices, quotations, clients, suppliers, projects, transactions, expenses, team members, accounts, categories, companies, and the other list pages.
- Undo also reverses the change in the database, not just on screen, so it stays undone after a refresh.

## Scope and limits

- Covers record create/edit/delete going through the shared data store.
- Not covered (and the buttons simply won't record them): file uploads to storage, sending emails, user/role provisioning, bulk data reloads/imports from the server, and AI chat.
- History is per browser session and clears on reload, so no stale undo of someone else's change.
- If a record was deleted or changed by someone else in the meantime, the undo is skipped and a toast explains why.

## Technical approach

1. **`src/lib/history.ts` (new)** — a small singleton history stack:
   - Entry shape: `{ label, undo: () => Promise<void>, redo: () => Promise<void> }`.
   - `push(entry)` caps the undo stack at 5 and clears the redo stack; `undo()` / `redo()` move entries between stacks; `subscribe()`/`getSnapshot()` for `useSyncExternalStore`.
   - A `suspended` flag so operations performed *by* undo/redo don't record new history entries.
2. **`src/lib/data-store.ts`** — record inverse operations at the single choke point:
   - `add(item)` → inverse `remove(item.id)`; `update(id, patch)` → inverse `update(id, previousValuesForPatchedKeys)`; `remove(id)` → inverse `add(previousItem)`.
   - `replaceAll` (hydration/sync) never records history.
   - Add an opt-out `opts.silent` used by `db-sync.ts` hydration paths and any programmatic writes.
   - Each collection gets an optional `labelFor(item)` so history entries read as "delete invoice INV-0012"; fall back to the collection key.
   - Because inverse ops call the same `add`/`update`/`remove`, existing `CollectionSync` hooks push the reversal to the backend automatically. Re-adding a deleted row re-inserts it and swaps in the new DB id.
3. **`src/components/app-shell.tsx`** — `useHistory()` hook drives two icon buttons (`Undo2`/`Redo2` from lucide) with aria-labels and tooltips; global keydown listener on `window`, ignored while focus is in an input/textarea/contenteditable so browser text undo still works there.
4. **Guarding write failures** — if the reversal's sync call rejects, surface the existing `reportWriteError` toast and re-push the entry so the state stays consistent.

## Verification

- Create, edit and delete a record on Invoices and Clients; undo each and confirm the row returns to its prior state and persists after reload.
- Confirm only the last 5 actions are reversible and that redo replays them in order.
- Confirm Cmd+Z inside a text field still edits text rather than reverting a record.
