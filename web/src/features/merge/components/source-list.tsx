import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { HfBadge } from "@/components/common/hf-badge"
import { LinkButton } from "@/components/common/link-button"
import { QueryNote } from "@/components/common/query-state"
import { SearchInput } from "@/components/common/search-input"
import type { Dataset } from "@/domain/dataset"
import { cn } from "@/lib/utils"

import { matches } from "../lib"

type ListQuery = { isPending: boolean; error: Error | null; refetch: () => unknown }

/** Multi-select list of mergeable datasets; the pick order is the merge order (shown as #1, #2, …) */
export function SourceList({
  datasets,
  query,
  picked,
  onToggle,
  onClear,
}: {
  datasets: Dataset[]
  query: ListQuery
  picked: string[]
  onToggle: (repoId: string) => void
  onClear: () => void
}) {
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const shown = datasets.filter((d) => matches(d, q))
  const loading = query.isPending || !!query.error

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Sources
          <span className="font-normal text-muted-foreground tabular-nums">
            {picked.length} of {datasets.length}
          </span>
        </span>
      }
      action={
        picked.length > 0 && (
          <button type="button" className="px-2 text-xs text-muted-foreground hover:text-foreground" onClick={onClear}>
            Clear
          </button>
        )
      }
    >
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search datasets or tasks"
        aria-label="Search datasets"
      />

      <ul className="-mx-1 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-1">
        {shown.map((d) => {
          const order = picked.indexOf(d.repoId)
          const on = order >= 0
          return (
            <li key={d.repoId}>
              <Label
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-normal transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <Checkbox checked={on} onCheckedChange={() => onToggle(d.repoId)} />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("truncate text-[13px]", on && "font-medium")}>{d.repoId}</span>
                    {d.hub.pushed && <HfBadge />}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {d.taskId}, {d.fps} fps, {d.episodeCount.toLocaleString()} episodes
                  </span>
                </span>
                {on && <span className="text-xs text-muted-foreground tabular-nums">#{order + 1}</span>}
              </Label>
            </li>
          )
        })}
        {loading && (
          <li className="px-2 py-8 text-center">
            <QueryNote query={query} />
          </li>
        )}
        {!loading && datasets.length === 0 && (
          <li>
            <EmptyState className="grid justify-items-center gap-3 px-4 py-8">
              합칠 수 있는 LeRobot 데이터셋이 없습니다. Convert 에서 데이터셋을 만드세요.
              <LinkButton to="/convert" variant="outline" size="sm">
                Open Convert
              </LinkButton>
            </EmptyState>
          </li>
        )}
        {!loading && datasets.length > 0 && shown.length === 0 && (
          <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 데이터셋이 없습니다.</li>
        )}
      </ul>
    </Panel>
  )
}
