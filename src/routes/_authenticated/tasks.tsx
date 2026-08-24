import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PlaceholderTable } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/tasks")({ component: TasksPage });

function TasksPage() {
  return (
    <AppShell>
      <PageHeader title="Tasks" description="Track work items across projects and teams." />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <PlaceholderTable
          title="All tasks"
          count="0 tasks"
          addLabel="New task"
          columns={["Task", "Status", "Assignee", "Project", "Priority", "Due date"]}
          emptyDescription="Work items will appear here once tasks are created, with status, assignee and due date."
        />
      </div>
    </AppShell>
  );
}
