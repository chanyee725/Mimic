import { useState } from "react"
import { LuSearch } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProgressRing } from "@/components/common/progress-ring"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { SearchInput } from "@/components/common/search-input"
import { useTasks } from "@/api/tasks"
import { TASK_RING_TONE, type Task } from "@/domain/task"
import { cn } from "@/lib/utils"

/** Shows the selected task (or a placeholder when none is picked); pick another one from a search dialog */
export function TaskPicker({ task, onSelect, disabled }: { task: Task | null; onSelect: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const tasks = useTasks()
  const results = (tasks.data ?? []).filter(
    (t) => !q || t.id.includes(q) || t.name.toLowerCase().includes(q) || t.instruction.toLowerCase().includes(q),
  )

  const pick = (id: string) => {
    onSelect(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border bg-muted/40 px-3 text-[13px]">
          {task ? <span className="truncate">{task.id}</span> : <span className="truncate text-muted-foreground">Select a task</span>}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0"
          aria-label="Search tasks"
          title={disabled ? "녹화 중에는 Task 를 바꿀 수 없습니다" : "Search tasks"}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <LuSearch />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select task</DialogTitle>
            <DialogDescription>Task 를 검색해서 선택합니다.</DialogDescription>
          </DialogHeader>
          <div>
            <SearchInput
              autoFocus
              aria-label="Search tasks"
              placeholder="Task id, name, label…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) pick(results[0].id)
              }}
            />
          </div>
          <ul className="-mx-2 grid max-h-80 content-start gap-0.5 overflow-y-auto">
            {results.map((t) => {
              const selected = t.id === task?.id
              const pct = t.targetEpisodes ? Math.min(100, Math.round((t.collected / t.targetEpisodes) * 100)) : 0
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pick(t.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                      selected && "bg-accent hover:bg-accent",
                    )}
                  >
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className={cn("truncate text-[13px]", selected && "font-medium")}>{t.id}</span>
                      <span className="truncate text-xs text-muted-foreground">{t.instruction}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t.collected}/{t.targetEpisodes}
                    </span>
                    <ProgressRing pct={pct} tone={TASK_RING_TONE[t.status]} label={`${t.id} progress`} thin className="size-8" />
                  </button>
                </li>
              )
            })}
            {tasks.isPending && (
              <li className="px-2 py-6 text-center">
                <LoadingNote />
              </li>
            )}
            {tasks.isError && (
              <li className="px-2 py-6">
                <ErrorNote error={tasks.error} onRetry={() => void tasks.refetch()} className="justify-center" />
              </li>
            )}
            {tasks.data && results.length === 0 && (
              <li className="py-6 text-center text-[13px] text-muted-foreground">검색 결과가 없습니다.</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
