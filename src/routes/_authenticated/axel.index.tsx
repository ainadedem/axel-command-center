import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { createAxelThread } from "@/lib/axel.functions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/axel/")({
  component: AxelIndex,
});

function AxelIndex() {
  const navigate = useNavigate();
  const create = useServerFn(createAxelThread);
  const qc = useQueryClient();

  const start = async () => {
    const t = await create({ data: { title: "New conversation" } });
    await qc.invalidateQueries({ queryKey: ["axel-threads"] });
    navigate({ to: "/axel/$threadId", params: { threadId: t.id } });
  };

  useEffect(() => {
    // auto-start a thread on first land
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-full grid place-items-center text-center px-8">
      <div>
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-chart-2 grid place-items-center mx-auto mb-4 shadow-[var(--shadow-glow)]">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-semibold mb-2">Axel AI</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Your CFO analyst. Ask about cash flow, margins, overdue invoices, client concentration,
          budgets, or any financial decision.
        </p>
      </div>
    </div>
  );
}
