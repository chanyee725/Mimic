import { useState } from "react"
import { LuHardDrive } from "react-icons/lu"

import { HfBadge } from "@/components/app/hf-badge"
import { Panel } from "@/components/app/page"
import { SearchInput } from "@/components/app/search-input"
import { Segmented } from "@/components/app/segmented"
import { MODELS, successRate } from "@/dummy/models"
import { formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"

import { FILTERS, SORTED, type Filter } from "../lib"

/** 왼쪽 모델 목록. 저장 위치로 거르고 이름 · Task · 데이터셋으로 찾는다 */
export function ModelList({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = SORTED.filter(FILTERS.find((f) => f.id === filter)!.fits).filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.taskId.includes(q) || m.dataset.includes(q),
  )

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Models
          <span className="font-normal text-muted-foreground tabular-nums">{MODELS.length}</span>
        </span>
      }
    >
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search models or tasks"
        aria-label="Search models"
      />
      <Segmented
        label="Location"
        fill
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ value: f.id, label: f.label, count: MODELS.filter(f.fits).length }))}
      />

      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {shown.map((m) => {
          const on = m.id === selected
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(m.id)}
                className={cn(
                  "grid w-full gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{m.name}</span>
                  {m.localPath && <LuHardDrive className="size-3 shrink-0 text-muted-foreground" aria-label="Local" />}
                  {m.hubRepo && <HfBadge title={m.hubRepo} />}
                </span>
                <span className="truncate text-xs text-muted-foreground">{m.taskId}</span>
                <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                  Step {m.step.toLocaleString()}, loss {m.loss.toFixed(3)}, success {formatPct(successRate(m))}
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 모델이 없습니다.</li>}
      </ul>
    </Panel>
  )
}
