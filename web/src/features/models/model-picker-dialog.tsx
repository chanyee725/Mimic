import { useState } from "react"
import { LuHardDrive, LuSearch } from "react-icons/lu"

import { HfBadge } from "@/components/app/hf-badge"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MODELS, successRate, type Model } from "@/dummy/models"
import { cn } from "@/lib/utils"

const TASKS = [...new Set(MODELS.map((m) => m.taskId))]

/** 저장한 모델 고르기. Task 로 거르고 이름 · 데이터셋으로 찾는다 */
export function ModelPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onSelect: (id: string) => void
}) {
  const [task, setTask] = useState("all")
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState(value)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setDraft(value)
  }
  const q = query.trim().toLowerCase()
  const rows = MODELS.filter(
    (m) =>
      (task === "all" || m.taskId === task) && (!q || m.name.toLowerCase().includes(q) || m.dataset.includes(q) || m.jobId.includes(q)),
  )
  const picked = MODELS.find((m) => m.id === draft)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(40rem,85svh)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a model</DialogTitle>
          <DialogDescription>Models 에 저장한 checkpoint 중에서 고릅니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <LuSearch
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models, datasets or jobs"
              aria-label="Search models"
              className="h-8 border-transparent bg-muted pl-8 text-[13px]"
            />
          </div>
          <div className="flex rounded-md bg-muted p-0.5" role="tablist" aria-label="Task">
            {["all", ...TASKS].map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={task === t}
                onClick={() => setTask(t)}
                className={cn(
                  "h-7 rounded-[5px] px-2.5 text-xs whitespace-nowrap transition-colors",
                  task === t ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "all" ? "All tasks" : t}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto rounded-md border">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-normal">Model</th>
                <th className="px-3 py-2 text-right font-normal">Step</th>
                <th className="px-3 py-2 text-right font-normal">Loss</th>
                <th className="px-3 py-2 text-right font-normal">Success</th>
                <th className="px-3 py-2 font-normal">Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y" role="radiogroup" aria-label="Model">
              {rows.map((m) => (
                <ModelRow key={m.id} model={m} on={m.id === draft} onPick={() => setDraft(m.id)} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    일치하는 모델이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button
            disabled={!picked}
            onClick={() => {
              if (picked) onSelect(picked.id)
              onOpenChange(false)
            }}
          >
            Use {picked?.name ?? "model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModelRow({ model: m, on, onPick }: { model: Model; on: boolean; onPick: () => void }) {
  const rate = successRate(m)
  return (
    <tr
      role="radio"
      aria-checked={on}
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onPick()
        }
      }}
      className={cn(
        "cursor-pointer transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60",
        on && "bg-accent hover:bg-accent",
      )}
    >
      <td className="px-3 py-2">
        <span className="flex items-center gap-2.5">
          <span className={cn("grid size-3.5 shrink-0 place-items-center rounded-full border", on && "border-foreground")}>
            {on && <span className="size-1.5 rounded-full bg-foreground" />}
          </span>
          <span className="grid min-w-0">
            <span className="truncate font-medium">{m.name}</span>
            <span className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              {m.jobId}, {m.dataset}
              {m.localPath && <LuHardDrive className="size-3" aria-label="Local" />}
              {m.hubRepo && <HfBadge title={m.hubRepo} />}
            </span>
          </span>
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{m.step.toLocaleString()}</td>
      <td className="px-3 py-2 text-right tabular-nums">{m.loss.toFixed(3)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{rate === undefined ? "—" : `${Math.round(rate * 100)}%`}</td>
      <td className="px-3 py-2 text-muted-foreground tabular-nums">{m.savedAt}</td>
    </tr>
  )
}
