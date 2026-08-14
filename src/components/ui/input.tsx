import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-border bg-card px-3.5 py-1 text-base shadow-none transition-[color,background-color,border-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground placeholder:transition-opacity hover:border-primary/35 focus:placeholder:opacity-60 focus-visible:outline-none focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
