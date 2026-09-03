import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 t-label font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--primary-container)] text-[var(--on-primary-container)] hover:brightness-[0.98]",
        secondary:
          "border-transparent bg-[var(--surface-container)] text-secondary-foreground hover:bg-[var(--surface-container-high)]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:brightness-110",
        outline: "border-outline text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
