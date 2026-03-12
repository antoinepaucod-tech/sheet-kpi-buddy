import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full px-3 py-1 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
        "bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-[var(--radius-md)]",
        "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]",
        "focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-0",
        "font-[var(--font-text)]",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
