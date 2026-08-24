import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/service-requests")({
  component: ServiceRequestsPage,
});

function ServiceRequestsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Service requests"
        description="Formal requests for service, access or change."
      />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <PlaceholderTable
          title="All service requests"
          count="0 requests"
          addLabel="New request"
          columns={["Reference", "Request", "Requester", "Type", "Status", "Requested"]}
          emptyDescription="Service, access and change requests will appear here with their requester and approval status."
        />
      </div>
    </AppShell>
  );
}
