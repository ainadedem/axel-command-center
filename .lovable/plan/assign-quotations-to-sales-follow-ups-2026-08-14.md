# Assign quotations to sales & follow-ups

Let up to 3 sales users own a quotation, see it even if they didn't create it, and log dated follow-ups with a next-action date.

## What you'll get

**Assignment (max 3)**
- On the quotation form and the quotations list: an "Assigned to" picker listing app users who have sales access in the current company.
- Hard cap of 3 assignees, shown as avatar chips on the list row and the quote detail.
- Assignees can view, edit and follow up on the quotation even when someone else created it.

**Follow-up tracking**
- A follow-up panel on each quotation: dated entries with type (call, email, meeting, note) and free text, newest first, showing who logged it.
- A "Next follow-up" date per quotation, editable inline; overdue dates show red, due-today amber, upcoming neutral.
- New filters on the quotations page: "Assigned to me", "Follow-up overdue", "No assignee".
- A "Follow-ups" column/badge so a rep can scan what needs a nudge.

## Technical notes

**Database migration**
- `quotes.assigned_to uuid[] NOT NULL DEFAULT '{}'` with a validation trigger enforcing at most 3 entries and no duplicates.
- `quotes.next_follow_up_at date NULL`.
- New table `public.quote_followups`: `id`, `company_id`, `quote_id` (FK, cascade), `kind` (call/email/meeting/note), `note text`, `happened_at timestamptz`, `created_by`, `created_at`, `updated_at` + updated_at trigger.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. RLS enabled.
- `quote_followups` policies: read/write when the user has a company role on `company_id` (`company_admin`, `manager`, `finance`, `project_manager`) or is the quote's creator/assignee; `created_by` frozen by trigger to `auth.uid()`.
- Update the `View quotes` SELECT policy to add `OR (app_private.has_company_access(auth.uid(), company_id) AND auth.uid() = ANY(assigned_to))`. Existing write policies unchanged.

**App code**
- `src/lib/mock-data.ts`: add `assignedTo?: string[]` and `nextFollowUpAt?: string` to `Quote`; add `QuoteFollowup` type + `quoteFollowupsStore` collection.
- `src/lib/db-sync.ts`: map the two new quote columns both ways; add fetch/upsert/delete for `quote_followups` and include it in the scoped load.
- New `src/components/quote-assignee-picker.tsx`: multi-select limited to 3, sourced from company users with a sales-capable role (reuses the user/company access data already loaded on Users & Access).
- New `src/components/quote-followup-panel.tsx`: timeline + add/edit/delete entry dialog + next-follow-up date field.
- `src/routes/_authenticated/quotations.tsx`: assignee chips column, follow-up badge, new filters, and both new components wired into the quote drawer/form.
- Sales-only visibility logic stays as-is, extended so a quote is visible when the current user is the creator **or** an assignee.
