import { StatusDot } from "@/components/common/status-dot"
import type { SimScene } from "@/domain/simulation"
import { cn } from "@/lib/utils"

/** Selectable scene rows with their task, cameras and whether they were matched to the real rig */
export function SceneList({ scenes, value, onChange }: { scenes: SimScene[]; value: string; onChange: (id: string) => void }) {
  return (
    <ul className="grid gap-1.5" role="radiogroup" aria-label="Scene">
      {scenes.map((s) => {
        const on = s.id === value
        return (
          <li key={s.id}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(s.id)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60",
                on && "border-foreground/40 bg-accent hover:bg-accent",
              )}
            >
              <span className={cn("mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border", on && "border-foreground")}>
                {on && <span className="size-1.5 rounded-full bg-foreground" />}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-medium">{s.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {s.taskId}, {s.cameras.join(" + ")}
                </span>
                {s.calibrated ? (
                  <StatusDot tone="ok" className="text-xs text-muted-foreground">
                    Matched to rig
                  </StatusDot>
                ) : (
                  <StatusDot tone="warn" className="items-baseline text-xs text-muted-foreground">
                    Not matched{s.note && `, ${s.note}`}
                  </StatusDot>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
