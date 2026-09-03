# Roadmap

## In progress
- [ ] Weekly payment approval run (Thursday): payment_runs / payment_requests schema, approvals page, off-cycle justification, Wednesday + Thursday reminders, notifications.

## Next
- [ ] CEO task list (to-dos) linked to projects, clients, quotations, invoices — assignable, due dates, visible on the dashboard.
- [ ] Unlink all invoice ↔ bank transaction matches (reset payment verification chain).
- [x] Journal: type-to-search PCG account picker.
- [x] Plan comptable: finance team can add/remove custom sub-accounts.
- [x] One condensed type scale (t-display/title/subtitle/body/label/micro) across pages, tables and forms.

## UI/motion pass (Notion-calm feel, no logic changes)
- [ ] Motion tokens (durations 120/180/260/400ms, ease-notion entrance/exit) + framer-motion install.
- [ ] Shared PageTransition wrapper (fade + 8px slide-up) on route changes; sidebar width/label crossfade at 180ms.
- [ ] Cmd+K command palette: jump to screen/client/project/invoice + quick add income/expense.
- [ ] Convert create/edit modals (transaction, invoice, client, project) to right-side slide-overs; keep small confirms centered.
- [ ] Hover-reveal row actions + content-shaped skeletons on Transactions, Invoices, Expenses.
- [ ] Inline editing on rows (amount, status, category) with optimistic updates and rollback toast.
- [ ] Visual restraint: 8px/6px radius scale, flat cards with hairline borders, shadows only on elevated layers, tabular-nums everywhere.

