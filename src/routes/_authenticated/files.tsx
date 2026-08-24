import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/files")({ component: FilesPage });

function FilesPage() {
  return (
    <AppShell>
      <PageHeader title="Files" description="Shared documents and assets for your team." />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <PlaceholderTable
          title="All files"
          count="0 files"
          addLabel="Upload file"
          columns={["Name", "Type", "Owner", "Project", "Size", "Updated"]}
          emptyDescription="Uploaded documents and assets will be listed here with their owner, project and last update."
        />
      </div>
    </AppShell>
  );
}
