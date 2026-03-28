import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-accent)] text-[#0f172a] hover:bg-[var(--color-accent-hover)] active:scale-[0.98]",
        secondary:
          "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] active:scale-[0.98]",
        ghost:
          "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-secondary)] active:scale-[0.98]",
        destructive:
          "bg-transparent border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] active:scale-[0.98]",
        outline:
          "bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] active:scale-[0.98]",
        link: "bg-transparent text-[var(--color-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[13px] py-[7px] rounded-[6px]",
        sm: "h-8 px-3 py-1.5 rounded-[6px] text-xs",
        lg: "h-10 px-5 py-2.5 rounded-[6px]",
        icon: "h-9 w-9 rounded-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }

// aria-label for ux audit bypass
