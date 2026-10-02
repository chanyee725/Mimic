import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { LuPlus } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { ProgressRing } from "@/components/common/progress-ring"
import { SearchInput } from "@/components/common/search-input"
import { CURRENT_TASK_ID } from "@/dummy/station"
import { TASKS, TASK_RING_TONE } from "@/dummy/tasks"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { successOf } from "../lib"

export function TaskList({ selectedId }: { selectedId: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const tasks = TASKS.filter((t) => !q || t.id.includes(q) || t.name.toLowerCase().includes(q) || t.instruction.toLowerCase().includes(q))

  // Same tone as the app sidebar: no dividers, light text, only the selected row gets a background
  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          All tasks
          <span className="font-normal text-muted-foreground tabular-nums">{TASKS.length}</span>
        </span>
      }
      action={
        <Button variant="ghost" size="icon-sm" aria-label="New task" title="New task" className="text-muted-foreground">
          <LuPlus />
        </Button>
      }
    >
      <SearchInput
        className="px-1"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {tasks.map((t) => {
          const selected = t.id === selectedId
          const current = t.id === CURRENT_TASK_ID
          const pct = Math.min(100, Math.round((t.collected / t.targetEpisodes) * 100))
          const { sessions, success } = successOf(t.id)
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-current={selected ? "page" : undefined}
                onClick={() => navigate(`/tasks/${t.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  selected && "bg-accent hover:bg-accent",
                )}
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("min-w-0 truncate text-[13px]", selected ? "font-medium" : "font-normal")}>{t.id}</span>
                    {current && (
                      <span className="shrink-0 rounded-sm bg-bad-muted px-1 text-[10px] font-medium tracking-wide text-bad">REC</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.instruction}</p>
                  <p className="truncate text-[11px] text-muted-foreground/80 tabular-nums">
                    {t.collected}/{t.targetEpisodes} · {plural(sessions, "session")} · success {success === null ? "—" : `${success}%`}
                  </p>
                </div>
                <ProgressRing pct={pct} tone={TASK_RING_TONE[t.status]} label={`${t.id} progress`} thin className="size-10" />
              </button>
            </li>
          )
        })}
        {tasks.length === 0 && <li className="py-6 text-center text-[13px] text-muted-foreground">No tasks found.</li>}
      </ul>
    </Panel>
  )
}
