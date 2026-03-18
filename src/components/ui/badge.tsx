import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase tracking-[0.06em]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent-subtle text-primary text-[var(--text-xs)]",
        secondary: "border-transparent bg-secondary text-secondary-foreground text-[var(--text-xs)]",
        destructive: "border-transparent bg-destructive/15 text-destructive text-[var(--text-xs)]",
        outline: "text-foreground text-[var(--text-xs)]",
        success: "border-transparent bg-success/15 text-success text-[var(--text-xs)]",
        warning: "border-transparent bg-warning/15 text-warning text-[var(--text-xs)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
