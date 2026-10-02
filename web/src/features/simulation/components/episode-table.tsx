import { useState } from "react"
import { LuChevronLeft, LuChevronRight } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { Segmented } from "@/components/common/segmented"
import { StatusDot } from "@/components/common/status-dot"
import type { SimJob } from "@/domain/simulation"
import { cn } from "@/lib/utils"

import { EPISODES_PER_PAGE, RESULT_FILTERS, type ResultFilter } from "../job-stats"

/** Finished episodes, filterable by result and paged. Clicking a row opens it in the rollout viewer */
export function EpisodeTable({ job, selected, onSelect }: { job: SimJob; selected?: number; onSelect: (index: number) => void }) {
  const [filter, setFilter] = useState<ResultFilter>("all")
  const [page, setPage] = useState(0)

  const match = RESULT_FILTERS.find((f) => f.value === filter)?.match ?? (() => true)
  const rows = job.results.filter(match)
  const pages = Math.max(1, Math.ceil(rows.length / EPISODES_PER_PAGE))
  const p = Math.min(page, pages - 1)
  const from = p * EPISODES_PER_PAGE
  const shown = rows.slice(from, from + EPISODES_PER_PAGE)

  const changeFilter = (f: ResultFilter) => {
    setFilter(f)
    setPage(0)
  }

  return (
    <Panel
      title="Episodes"
      className="min-h-80 flex-1"
      action={
        job.results.length > 0 && (
          <Segmented
            label="Result"
            value={filter}
            onChange={changeFilter}
            options={RESULT_FILTERS.map((f) => ({ value: f.value, label: f.label, count: job.results.filter(f.match).length }))}
          />
        )
      }
    >
      {job.results.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">
          {job.status === "queued" ? "GPU 가 비면 시작합니다. 끝난 에피소드가 여기에 쌓입니다." : "끝난 에피소드가 없습니다."}
        </p>
      ) : (
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
                      onClick={() => onSelect(e.index)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault()
                          onSelect(e.index)
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
            {rows.length === 0 && <p className="py-6 text-center text-[13px] text-muted-foreground">해당하는 에피소드가 없습니다.</p>}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{rows.length ? `${from + 1}–${from + shown.length} of ${rows.length}` : "0 of 0"}</span>
            <span className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={p === 0} onClick={() => setPage(p - 1)}>
                <LuChevronLeft />
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>
                Next
                <LuChevronRight />
              </Button>
            </span>
          </div>
        </>
      )}
    </Panel>
  )
}
