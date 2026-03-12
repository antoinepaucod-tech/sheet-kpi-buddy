import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-accent)] text-white shadow-none hover:opacity-85 rounded-[var(--radius-md)]",
        destructive:
          "bg-[var(--color-danger)] text-white shadow-none hover:opacity-85 rounded-[var(--radius-md)]",
        outline:
          "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-primary)] hover:opacity-85 rounded-[var(--radius-md)]",
        secondary:
          "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] shadow-none hover:opacity-85 rounded-[var(--radius-md)]",
        ghost: "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-[var(--radius-md)]",
        link: "text-[var(--color-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-5 py-2",
        sm: "h-8 px-3 text-xs rounded-[var(--radius-sm)]",
        lg: "h-11 px-8 rounded-[var(--radius-md)]",
        icon: "h-9 w-9 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
