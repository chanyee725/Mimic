import type { IconType } from "react-icons"

import { cn } from "@/lib/utils"

export type SegmentedOption<T> = {
  value: T
  label: React.ReactNode
  /** Grey count after the label */
  count?: number
  icon?: IconType
  /** Coloured dot before the label (bg-* class) */
  dot?: string
}

/**
 * Pill buttons on a grey track, used both to filter lists (tablist) and to pick a value (radiogroup).
 * With fill the buttons share the width; otherwise they take their content width.
 */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  role = "tablist",
  fill = false,
  size = "sm",
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  label: string
  role?: "tablist" | "radiogroup"
  fill?: boolean
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div className={cn("flex rounded-md bg-muted p-0.5", className)} role={role} aria-label={label}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role={role === "tablist" ? "tab" : "radio"}
            aria-selected={role === "tablist" ? on : undefined}
            aria-checked={role === "radiogroup" ? on : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-[5px] whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 gap-1 text-xs" : "h-8 gap-1.5 text-[13px]",
              fill ? "flex-1 px-2" : "px-2.5",
              on ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.dot && <span className={cn("mr-0.5 size-1.5 rounded-full", o.dot)} aria-hidden />}
            {o.icon && <o.icon className="size-3.5" aria-hidden />}
            {o.label}
            {o.count !== undefined && <span className="text-muted-foreground tabular-nums">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
