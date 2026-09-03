import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Mail, CalendarDays, MessageSquare, CreditCard, Cloud, Database,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
});

const apps = [
  { name: "Email", description: "Send documents and reminders from your own domain.", icon: Mail },
  { name: "Calendar", description: "Sync due dates, follow-ups and leave into your calendar.", icon: CalendarDays },
  { name: "Chat", description: "Post document and pipeline updates to a team channel.", icon: MessageSquare },
  { name: "Payments", description: "Reconcile card and online payments against invoices.", icon: CreditCard },
  { name: "Cloud storage", description: "Archive exported PDFs to your shared drive.", icon: Cloud },
  { name: "Accounting export", description: "Push journal entries to an external ledger.", icon: Database },
];

function IntegrationsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Integrations Hub"
        description="Connect Axel to the tools your team already uses."
      />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <div key={app.name} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 t-micro uppercase tracking-wider text-muted-foreground">
                    Not connected
                  </span>
                </div>
                <h3 className="mt-3 t-body font-semibold text-foreground">{app.name}</h3>
                <p className="mt-1 t-label leading-relaxed text-muted-foreground">{app.description}</p>
                <div className="mt-4">
                  <Button size="sm" variant="outline" disabled>
                    Connect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
