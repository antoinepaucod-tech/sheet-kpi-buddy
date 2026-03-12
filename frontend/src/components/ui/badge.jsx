import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors focus:outline-none rounded-[var(--radius-sm)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-accent-subtle)] text-[var(--color-accent)]",
        secondary:
          "border-transparent bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]",
        destructive:
          "border-transparent bg-[rgba(255,69,58,0.15)] text-[var(--color-danger)]",
        outline: "text-[var(--color-text-primary)] border-[var(--color-border)]",
        success:
          "border-transparent bg-[rgba(48,209,88,0.15)] text-[var(--color-success)]",
        warning:
          "border-transparent bg-[rgba(255,214,10,0.15)] text-[var(--color-warning)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
