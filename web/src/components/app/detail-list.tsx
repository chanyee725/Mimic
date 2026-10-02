import { cn } from "@/lib/utils"

export type DetailRow = { k: string; v: React.ReactNode }

/** 왼쪽 이름 · 오른쪽 값 한 줄씩, 줄 사이 구분선 */
export function DetailList({ rows, bordered = false, className }: { rows: DetailRow[]; bordered?: boolean; className?: string }) {
  return (
    <dl className={cn("divide-y", bordered && "rounded-md border px-3", className)}>
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-4 py-2 text-[13px]">
          <dt className="shrink-0 text-muted-foreground">{r.k}</dt>
          <dd className="min-w-0 truncate text-right tabular-nums">{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}
