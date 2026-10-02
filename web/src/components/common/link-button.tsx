import type { VariantProps } from "class-variance-authority"
import { Link, type LinkProps } from "react-router-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A router Link that looks like a Button. It renders through Button's `render` prop so
 * variant classes are merged by Button itself (the raw buttonVariants string keeps conflicting
 * border classes and drops the outline border).
 */
export function LinkButton({
  to,
  variant,
  size,
  disabled = false,
  className,
  children,
  ...props
}: Omit<LinkProps, "className"> & VariantProps<typeof buttonVariants> & { disabled?: boolean; className?: string }) {
  return (
    <Button
      nativeButton={false}
      variant={variant}
      size={size}
      aria-disabled={disabled || undefined}
      className={cn(disabled && "pointer-events-none opacity-50", className)}
      render={<Link to={to} {...props} />}
    >
      {children}
    </Button>
  )
}
