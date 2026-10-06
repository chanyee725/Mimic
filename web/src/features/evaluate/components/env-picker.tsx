import { useEffect, useRef } from "react"

import { EnvThumb } from "@/components/robot/env-thumb"
import type { SimEnv } from "@/domain/simulation"
import { cn } from "@/lib/utils"

/**
 * Imported environments as a radio list; arrow keys move the selection (roving tabindex).
 */
export function EnvPicker({ envs, value, onChange }: { envs: SimEnv[]; value?: string; onChange: (id: string) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const listRef = useRef<HTMLDivElement>(null)
  // The selected row takes focus; with nothing selected the first row does
  const focusId = envs.some((e) => e.id === value) ? value : envs[0]?.id

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
    const at = envs.findIndex((o) => o.id === focusId)
    let next: number | undefined
    if (step) next = (at + step + envs.length) % envs.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = envs.length - 1
    const id = next === undefined ? undefined : envs[next]?.id
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
      {envs.map((env) => {
        const on = env.id === value
        return (
          <button
            key={env.id}
            ref={(el) => {
              if (el) refs.current.set(env.id, el)
              else refs.current.delete(env.id)
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={env.id === focusId ? 0 : -1}
            onClick={() => onChange(env.id)}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60",
              on && "border-foreground/40 bg-accent hover:bg-accent",
            )}
          >
            <span className={cn("mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border", on && "border-foreground")}>
              {on && <span className="size-1.5 rounded-full bg-foreground" />}
            </span>
            <EnvThumb env={env} className="w-12" />
            <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
              <span className="truncate font-medium">{env.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{env.scene}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
