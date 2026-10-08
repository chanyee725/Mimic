import { cn } from "@/lib/utils"

/** Label and hint on the left, the control in a fixed-width column on the right (controls line up across rows) */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid items-center gap-x-6 gap-y-2 @lg:grid-cols-[minmax(0,1fr)_16rem]", className)}>
      <div className="grid min-w-0 gap-0.5">
        <label htmlFor={htmlFor} className="text-[13px]">
          {label}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {/* Segmented controls span the column like inputs, so every row ends on the same edges */}
      <div className="flex min-w-0 items-center justify-end gap-2 [&>[role=radiogroup]]:w-full">{children}</div>
    </div>
  )
}
