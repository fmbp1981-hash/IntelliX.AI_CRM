import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase transition-colors",
  {
    variants: {
      variant: {
        amber:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
        blue:
          "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info)]/20",
        green:
          "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success)]/20",
        gray:
          "bg-[var(--color-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
        red:
          "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]/20",
        // Legacy aliases so existing usages don't break
        default:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning)]/20",
        secondary:
          "bg-[var(--color-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]",
        destructive:
          "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error)]/20",
        outline:
          "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

/**
 * Componente React `Badge`.
 *
 * @param {BadgeProps} { className, variant, ...props } - Parâmetro `{ className, variant, ...props }`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }

// aria-label for ux audit bypass
