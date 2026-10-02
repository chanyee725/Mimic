import type { IconType } from "react-icons"

import { cn } from "@/lib/utils"

export type Stat = { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: IconType }

/** 지표를 카드 대신 구분선으로 나뉜 한 줄 스트립으로 보여준다. */
export function StatStrip({ items, className }: { items: Stat[]; className?: string }) {
  return (
    <div
      className={cn("grid divide-y rounded-lg border sm:divide-x sm:divide-y-0", className)}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((s) => (
        <div key={s.label} className="grid min-w-0 gap-1.5 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] text-muted-foreground">{s.label}</span>
            {s.icon && <s.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-2xl font-medium tracking-tight whitespace-nowrap">{s.value}</span>
            {s.sub && <span className="text-xs text-muted-foreground">{s.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
