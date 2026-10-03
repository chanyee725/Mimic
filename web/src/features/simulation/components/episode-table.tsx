import { useState } from "react"
import { LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { Segmented } from "@/components/common/segmented"
import { StatusDot } from "@/components/common/status-dot"
import { useSimEpisodes } from "@/api/simulation"
import type { SimEpisode, SimJob } from "@/domain/simulation"
import { cn } from "@/lib/utils"

import { EPISODES_PER_PAGE, RESULT_FILTERS, type ResultFilter } from "../job-stats"
import { ErrorNote, Loading } from "./query-state"

/**
 * Finished episodes, filterable by result and paged. Server pages (100 rows) load as the table pages
 * past them. Clicking a row opens it in the rollout viewer.
 */
export function EpisodeTable({ job, selected, onSelect }: { job: SimJob; selected?: number; onSelect: (episode: SimEpisode) => void }) {
  const [filter, setFilter] = useState<ResultFilter>("all")
  const [page, setPage] = useState(0)
  const query = useSimEpisodes(job.id, filter === "all" ? undefined : filter)

  const rows = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / EPISODES_PER_PAGE))
  const p = Math.min(page, pages - 1)
  const from = p * EPISODES_PER_PAGE
  const shown = rows.slice(from, from + EPISODES_PER_PAGE)
  // The page reaches past the loaded rows: its server page is still on the way
  const waiting = shown.length < Math.min(EPISODES_PER_PAGE, total - from) && (query.hasNextPage || query.isFetchingNextPage)

  const changeFilter = (f: ResultFilter) => {
    setFilter(f)
    setPage(0)
  }

  const goTo = (next: number) => {
    setPage(next)
    const need = (next + 1) * EPISODES_PER_PAGE
    if (need > rows.length && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
  }

  let body: React.ReactNode
  if (query.isPending) body = <Loading />
  else if (query.isError) body = <ErrorNote error={query.error} onRetry={query.refetch} />
  else
    body = (
      <>
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto">
          <table className="w-full table-fixed text-[13px]">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-14 px-2 py-2 font-normal">#</th>
                <th className="w-20 px-2 py-2 font-normal">Seed</th>
                <th className="w-24 px-2 py-2 font-normal">Result</th>
                <th className="w-20 px-2 py-2 text-right font-normal">Time</th>
                <th className="px-2 py-2 pl-6 font-normal">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y" role="radiogroup" aria-label="Episode">
              {shown.map((e) => {
                const on = e.index === selected
                return (
                  <tr
                    key={e.index}
                    role="radio"
                    aria-checked={on}
                    aria-label={`Episode ${e.index}`}
                    tabIndex={0}
                    onClick={() => onSelect(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault()
                        onSelect(e)
                      }
                    }}
                    className={cn(
                      "cursor-pointer transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60",
                      on && "bg-accent hover:bg-accent",
                    )}
                  >
                    <td className="px-2 py-1.5 tabular-nums">{e.index}</td>
                    <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{e.seed}</td>
                    <td className="px-2 py-1.5">
                      <StatusDot tone={e.success ? "ok" : "bad"} className="text-[13px]">
                        {e.success ? "Success" : "Fail"}
                      </StatusDot>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{e.seconds.toFixed(1)} s</td>
                    <td className="truncate px-2 py-1.5 pl-6 text-muted-foreground">{e.reason ?? "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {waiting && <Loading className="py-6" />}
          {total === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">해당하는 에피소드가 없습니다.</p>}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{total ? `${from + 1}–${Math.min(from + EPISODES_PER_PAGE, total)} of ${total.toLocaleString()}` : "0 of 0"}</span>
          <span className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={p === 0} onClick={() => goTo(p - 1)}>
              <LuChevronLeft />
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={p >= pages - 1} onClick={() => goTo(p + 1)}>
              Next
              <LuChevronRight />
            </Button>
          </span>
        </div>
      </>
    )

  return (
    <Panel
      title="Episodes"
      className="min-h-80 flex-1"
      action={
        job.done > 0 && (
          <Segmented
            label="Result"
            value={filter}
            onChange={changeFilter}
            options={RESULT_FILTERS.map((f) => ({ value: f.value, label: f.label, count: f.count(job) }))}
          />
        )
      }
    >
      {job.done === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">
          {job.status === "queued" ? "GPU 가 비면 시작합니다. 끝난 에피소드가 여기에 쌓입니다." : "끝난 에피소드가 없습니다."}
        </p>
      ) : (
        body
      )}
    </Panel>
  )
}
