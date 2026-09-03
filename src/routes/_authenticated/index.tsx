import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, ArrowRight } from "lucide-react";
import { AxelWordmark } from "@/components/axel-wordmark";
import { MODULES } from "@/lib/modules";
import { lastModuleId, SALES_ROUTES } from "@/components/app-shell";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { ThemeControls } from "@/components/theme-controls";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({ component: Launcher });

function Launcher() {
  const { isSalesOnly, isGroupAdmin } = useEffectiveRole();
  const { profile, user } = useAuth();
  const { label } = useCompany();
  const navigate = useNavigate();
  const [resumeId, setResumeId] = useState<string | null>(null);

  useEffect(() => setResumeId(lastModuleId()), []);

  const modules = MODULES.map((mod) => {
    const items = mod.sections
      .flatMap((s) => s.items)
      .filter(
        (item) =>
          (!item.requireGroupAdmin || isGroupAdmin) &&
          (!isSalesOnly || SALES_ROUTES.includes(item.to)),
      );
    return { ...mod, items };
  }).filter((mod) => mod.items.length > 0);

  const resume = modules.find((m) => m.id === resumeId) ?? undefined;
  const firstName = (profile?.display_name || user?.email || "").split(/[\s@]/)[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <AxelWordmark title="AXEL Business Platform" className="h-7 w-auto text-foreground" />
            <p className="mt-2 t-label tracking-[0.06em] text-muted-foreground">{label}</p>
          </div>
          <ThemeControls />
        </header>

        <div className="mt-10 sm:mt-14">
          <h1 className="font-display text-[1.75rem] sm:text-[2.25rem] font-medium tracking-[-0.01em] leading-tight">
            {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
          </h1>
          <p className="mt-2 max-w-2xl t-body leading-relaxed text-muted-foreground">
            Choose which Axel you want to work in. You can switch at any time from the sidebar.
          </p>

          {resume && (
            <button
              type="button"
              onClick={() => navigate({ to: resume.defaultTo })}
              className="focus-ring press-scale mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 t-body font-medium text-primary-foreground transition hover:opacity-90"
            >
              Continue in {resume.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.id}
                to={mod.defaultTo}
                className={cn(
                  "hover-lift focus-ring group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200",
                  mod.id === resumeId && "ring-1 ring-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary-container)] text-[var(--on-primary-container)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <ChevronRight
                    className="h-4 w-4 text-foreground/35 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="mt-4 font-display t-subtitle font-semibold">{mod.label}</h2>
                <p className="mt-1 t-label leading-relaxed text-muted-foreground">{mod.description}</p>
                <p className="mt-4 t-label uppercase tracking-[0.12em] text-foreground/45">
                  {mod.items.length} {mod.items.length === 1 ? "page" : "pages"}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
