import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/tickets")({ component: TicketsPage });

function TicketsPage() {
  return (
    <AppShell>
      <PageHeader title="Tickets" description="Customer issues raised through support channels." />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <PlaceholderTable
          title="All tickets"
          count="0 tickets"
          addLabel="New ticket"
          columns={["Reference", "Subject", "Client", "Status", "Priority", "Opened"]}
          emptyDescription="Support tickets will be listed here with their client, priority and current status."
        />
      </div>
    </AppShell>
  );
}
