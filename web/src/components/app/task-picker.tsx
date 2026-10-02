import { useState } from "react"
import { LuSearch } from "react-icons/lu"

import { ProgressRing } from "@/components/app/progress-ring"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { TASKS, type Task } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

/** 선택된 Task 표시 + 검색 모달로 다른 Task 선택 */
export function TaskPicker({ task, onSelect, disabled }: { task: Task; onSelect: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const results = TASKS.filter((t) => !q || t.id.includes(q) || t.name.toLowerCase().includes(q) || t.instruction.toLowerCase().includes(q))

  const pick = (id: string) => {
    onSelect(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="flex h-9 min-w-0 flex-1 items-center rounded-md border bg-muted/40 px-3 text-[13px]">
          <span className="truncate">{task.id}</span>
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
            <DialogDescription>녹화할 Task 를 검색해서 선택합니다.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <LuSearch className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              aria-label="Search tasks"
              placeholder="Task id, name, label…"
              className="h-9 pl-8 text-[13px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) pick(results[0].id)
              }}
            />
          </div>
          <ul className="-mx-2 grid max-h-80 content-start gap-0.5 overflow-y-auto">
            {results.map((t) => {
              const selected = t.id === task.id
              const pct = Math.min(100, Math.round((t.collected / t.targetEpisodes) * 100))
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
                    <ProgressRing pct={pct} status={t.status} label={`${t.id} progress`} thin className="size-8" />
                  </button>
                </li>
              )
            })}
            {results.length === 0 && <li className="py-6 text-center text-[13px] text-muted-foreground">검색 결과가 없습니다.</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
