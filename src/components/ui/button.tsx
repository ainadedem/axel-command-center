import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full t-body font-medium cursor-pointer select-none transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform motion-reduce:transition-none motion-reduce:active:scale-100 active:scale-[0.98] active:duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-none hover:bg-[var(--primary-hover)] hover:shadow-[var(--shadow-soft)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-none hover:brightness-110 hover:shadow-[var(--shadow-soft)]",
        outline:
          "border border-outline bg-transparent text-foreground shadow-none hover:bg-[var(--surface-container)] hover:text-foreground",
        secondary:
          "bg-[var(--surface-container)] text-secondary-foreground shadow-none hover:bg-[var(--surface-container-high)] hover:text-foreground",
        tonal:
          "bg-[var(--primary-container)] text-[var(--on-primary-container)] shadow-none hover:bg-[color-mix(in_oklab,var(--primary-container)_82%,var(--surface))] hover:shadow-[var(--shadow-soft)]",
        elevated:
          "bg-surface text-primary shadow-[var(--shadow-elevated)] hover:bg-[var(--surface-container)] hover:shadow-[0_1px_3px_rgba(60,64,67,0.2),0_6px_16px_rgba(60,64,67,0.14)]",
        ghost: "text-foreground hover:bg-[var(--surface-container)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[var(--field-h)] px-4 py-2",
        sm: "h-8 px-3 t-label",
        lg: "h-12 px-7",
        icon: "h-[var(--field-h)] w-[var(--field-h)] tap-target",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows an inline spinner and blocks interaction while true. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
