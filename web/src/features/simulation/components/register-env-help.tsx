import { Link } from "react-router-dom"
import { LuChevronRight } from "react-icons/lu"

import { getSimEnvsDir } from "@/api/simulation"
import { cn } from "@/lib/utils"

const LAYOUT: { file: string; hint: string }[] = [
  { file: "env.yaml", hint: "name, task, cameras, action_dim, time limit" },
  { file: "scene.usd", hint: "Isaac Sim stage" },
  { file: "success.py", hint: "success / failure reason per episode" },
]

/** How to register an environment: the expected folder layout. Collapsible so the list keeps its room */
export function RegisterEnvHelp({ defaultOpen = false, className }: { defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={cn("group rounded-md border border-dashed px-3 py-2", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        <LuChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        Register an environment
      </summary>
      <div className="grid gap-2 pt-2">
        <div className="grid gap-0.5 overflow-x-auto font-mono text-[11px] leading-5">
          <span className="whitespace-nowrap">{getSimEnvsDir()}/&lt;env-name&gt;/</span>
          {LAYOUT.map((l) => (
            <span key={l.file} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 pl-3">
              <span>{l.file}</span>
              <span className="text-muted-foreground">{l.hint}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          폴더를 만들고 Rescan 하면 목록에 나타납니다. 폴더 위치는{" "}
          <Link to="/settings?section=training" className="underline underline-offset-4 hover:text-foreground">
            Settings
          </Link>{" "}
          → Training 에서 바꿀 수 있습니다.
        </p>
      </div>
    </details>
  )
}
