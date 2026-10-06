import { useEffect, useRef } from "react"

import { StatusDot } from "@/components/common/status-dot"
import type { Task } from "@/domain/task"
import { cn } from "@/lib/utils"

import type { EnvOption } from "../lib"

/**
 * Registered environments as a radio list. Rows the model can be loaded into are selectable;
 * the rest are listed muted under their own label with the reason they can't load it.
 * Arrow keys move the selection between selectable rows (roving tabindex).
 */
export function EnvPicker({
  options,
  tasks,
  value,
  onChange,
}: {
  options: EnvOption[]
  /** For task names */
  tasks: Task[]
  value?: string
  onChange: (id: string) => void
}) {
  const taskName = (id?: string) => (id && tasks.find((t) => t.id === id)?.name) ?? id ?? "No task"
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const listRef = useRef<HTMLDivElement>(null)
  const usable = options.filter((o) => o.usable)
  const blocked = options.filter((o) => !o.usable)
  // The selected row takes focus; with nothing selected the first usable row does
  const focusId = usable.some((o) => o.env.id === value) ? value : usable[0]?.env.id

  // Keep the selected row in view inside the list (without scrolling the page)
  useEffect(() => {
    const list = listRef.current
    const row = value ? refs.current.get(value) : undefined
    if (!list || !row) return
    const hidden = row.offsetTop < list.scrollTop || row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight
    if (hidden) list.scrollTop = row.offsetTop - list.clientHeight / 3
  }, [value])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    const at = usable.findIndex((o) => o.env.id === focusId)
    let next: number | undefined
    if (step) next = (at + step + usable.length) % usable.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = usable.length - 1
    const id = next === undefined ? undefined : usable[next]?.env.id
    if (!id) return
    e.preventDefault()
    onChange(id)
    refs.current.get(id)?.focus()
  }

  return (
    <div
      ref={listRef}
      className="relative grid max-h-80 grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto pr-0.5"
      role="radiogroup"
      aria-label="Environment"
      onKeyDown={onKeyDown}
    >
      {usable.map((o) => (
        <EnvRow
          key={o.env.id}
          option={o}
          taskName={taskName(o.env.taskId)}
          on={o.env.id === value}
          tabbable={o.env.id === focusId}
          onSelect={() => onChange(o.env.id)}
          buttonRef={(el) => {
            if (el) refs.current.set(o.env.id, el)
            else refs.current.delete(o.env.id)
          }}
        />
      ))}
      {blocked.length > 0 && (
        <>
          <span className="mt-1.5 text-xs text-muted-foreground">Can&apos;t load this model</span>
          {blocked.map((o) => (
            <EnvRow key={o.env.id} option={o} taskName={taskName(o.env.taskId)} on={false} tabbable={false} />
          ))}
        </>
      )}
    </div>
  )
}

function EnvRow({
  option: { env, issues, usable },
  taskName,
  on,
  tabbable,
  onSelect,
  buttonRef,
}: {
  option: EnvOption
  taskName: string
  on: boolean
  tabbable: boolean
  onSelect?: () => void
  buttonRef?: (el: HTMLButtonElement | null) => void
}) {
  const errors = issues.filter((i) => i.level === "error")
  const warns = issues.filter((i) => i.level === "warn")
  return (
    <button
      ref={buttonRef}
      type="button"
      role="radio"
      aria-checked={on}
      aria-disabled={!usable || undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={usable ? onSelect : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors",
        usable ? "hover:bg-accent/60" : "cursor-not-allowed border-dashed text-muted-foreground",
        on && "border-foreground/40 bg-accent hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border",
          on && "border-foreground",
          !usable && "opacity-50",
        )}
      >
        {on && <span className="size-1.5 rounded-full bg-foreground" />}
      </span>
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
        <span className={cn("truncate", usable && "font-medium")}>{env.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {env.id}, {taskName}, {env.cameras.join(" + ")}
        </span>
        {errors.length > 0 ? (
          <StatusDot tone="bad" className="text-xs text-muted-foreground">
            <span className="line-clamp-2 [overflow-wrap:anywhere]">{errors.map((i) => i.text).join(", ")}</span>
          </StatusDot>
        ) : warns.length > 0 ? (
          <StatusDot tone="warn" className="text-xs text-muted-foreground">
            {warns.map((i) => i.text).join(", ")}
          </StatusDot>
        ) : (
          <StatusDot tone="ok" className="text-xs text-muted-foreground">
            Compatible
          </StatusDot>
        )}
      </span>
    </button>
  )
}
