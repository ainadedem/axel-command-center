# Link a new user to a team member while adding them

Today the Add user dialog only creates the account and grants roles. Linking to a person in the Team database happens afterwards, as a small "Add to team" / "Link to team member ..." link on the user row. That step is easy to miss, so new accounts often stay unlinked.

## What changes

Add a **Team profile** field to the Add user dialog, below Full name:

- **Auto (match by email, otherwise create)** — default. Links to the existing team member with the same email; if there is none, creates a new Team profile from the name/email entered.
- **Pick an existing team member** — a searchable list of team members (name + email + job title), showing only people not already linked to another account. Selecting one links that profile to the new account.
- **Don't link now** — keeps today's behaviour.

Behaviour details:

- The list shows a hint when the picked member already has a different email than the one typed, so the admin sees they are linking two different addresses.
- If a company role was granted, a newly created Team profile is assigned to that company (single company selected) or left as "All companies"/unassigned when several were granted, matching the existing team visibility model.
- Linking happens right after the account is created. If the link write fails, the account still exists and a toast explains the profile can be linked from the user row — the account is never rolled back for a link failure.
- The existing per-row link control stays as-is for accounts created earlier.
- The sales-role sync that already runs after creation keeps working: if a `sales` role was granted, the linked profile is the one used for the Sales team entry instead of a duplicate being created.

## Technical notes

- Only `src/routes/_authenticated/users-access.tsx` changes. `AddUserDialog` gains local state (`teamMode`: `auto` | `existing` | `none`, `teamMemberId`) and reads `useTeamMembers()`; candidates exclude members with a `userId` already set.
- After `createAppUser` resolves (it already returns `{ userId, email }`), the dialog calls `teamMembersStore.update(id, { userId })` for the existing-member case, or `teamMembersStore.add({...})` for the auto/create case — the same store calls the current `TeamLink` helper makes, so the link persists through the existing db-sync path.
- The link step runs before `onCreated()` so the reload and `syncSalesTeam()` see the link.
- No server function change, no schema change, no new RLS.
