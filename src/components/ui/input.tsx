import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-outline/70 bg-card px-4 py-1 text-base shadow-none transition-[color,background-color,border-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground placeholder:transition-opacity hover:border-outline focus:placeholder:opacity-60 focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[inset_0_0_0_1px_var(--primary)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
