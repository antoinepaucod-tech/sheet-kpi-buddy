import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-ui transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Default - Brand purple
        default:
          "border-primary/30 bg-primary/20 text-primary",
        // Secondary - Tech blue
        secondary:
          "border-secondary/30 bg-secondary/20 text-secondary",
        // Destructive - Red
        destructive:
          "border-destructive/30 bg-destructive/20 text-destructive",
        // Success - Green
        success:
          "border-success/30 bg-success/20 text-success",
        // Warning - Yellow
        warning:
          "border-warning/30 bg-warning/20 text-warning",
        // Outline - Subtle
        outline:
          "border-border text-muted-foreground bg-transparent",
        // Muted - Very subtle
        muted:
          "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };