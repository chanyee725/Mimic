import { LuGlobe } from "react-icons/lu"
import { SiNvidia } from "react-icons/si"

import { TASK_WORLD_LABEL, type TaskWorld } from "@/domain/task"
import { cn } from "@/lib/utils"

// NVIDIA green, a shade darker for text so it reads on white
const SIM_ICON = "text-[#76B900]"
const SIM_TEXT = "text-[#5a8f00]"

/** Where a task or episode runs: Real (robot icon) or Isaac Sim (NVIDIA icon, green) */
export function WorldMark({ world, label = false, className }: { world: TaskWorld; label?: boolean; className?: string }) {
  const sim = world === "sim"
  const Icon = sim ? SiNvidia : LuGlobe
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 text-[11px]", sim ? SIM_TEXT : "text-muted-foreground", className)}
      title={label ? undefined : TASK_WORLD_LABEL[world]}
    >
      <Icon className={cn("size-3.5", sim && SIM_ICON)} aria-hidden={label} aria-label={label ? undefined : TASK_WORLD_LABEL[world]} />
      {label && TASK_WORLD_LABEL[world]}
    </span>
  )
}

/** Icons for every world a dataset holds (a merge of real and sim data shows both) */
export function WorldMarks({ worlds, className }: { worlds: readonly TaskWorld[]; className?: string }) {
  const shown = (["real", "sim"] as const).filter((w) => worlds.includes(w))
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)} title={shown.map((w) => TASK_WORLD_LABEL[w]).join(" + ")}>
      {shown.map((w) => (
        <WorldMark key={w} world={w} className="pointer-events-none" />
      ))}
    </span>
  )
}
