import { cn } from "@/lib/utils"

/** 왼쪽 이름 · 설명, 오른쪽 입력 */
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
    <div className={cn("grid items-center gap-x-6 gap-y-2 @lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]", className)}>
      <div className="grid min-w-0 gap-0.5">
        <label htmlFor={htmlFor} className="text-[13px]">
          {label}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">{children}</div>
    </div>
  )
}
