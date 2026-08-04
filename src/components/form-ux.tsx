import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const FORM_ERROR_MESSAGE = "Please review the highlighted required fields before continuing.";

export function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      <span className="text-destructive" aria-hidden="true">*</span>
    </span>
  );
}

export function FormErrorBanner({ show, message = FORM_ERROR_MESSAGE }: { show: boolean; message?: string }) {
  if (!show) return null;
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function invalidFieldClassName(invalid: boolean) {
  return cn(invalid && "border-destructive focus-visible:ring-destructive/30");
}
