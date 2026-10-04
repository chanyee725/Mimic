import { LuChevronRight } from "react-icons/lu"

import { useSimConfig } from "@/api/simulation"
import { cn } from "@/lib/utils"

const LAYOUT: { file: string; hint: string }[] = [
  { file: "env.yaml", hint: "name, task, cameras, action_dim, time limit" },
  { file: "scene.usd", hint: "Isaac Sim stage" },
  { file: "success.py", hint: "success / failure reason per episode" },
]

/** How to register an environment: the expected folder layout. Collapsible so the list keeps its room */
export function RegisterEnvHelp({ defaultOpen = false, className }: { defaultOpen?: boolean; className?: string }) {
  const envsDir = useSimConfig().data?.envsDir ?? "…"
  return (
    <details open={defaultOpen} className={cn("group rounded-md border border-dashed px-3 py-2", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        <LuChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
        Register an environment
      </summary>
      <div className="grid gap-2 pt-2">
        <div className="grid gap-0.5 overflow-x-auto font-mono text-[11px] leading-5">
          <span className="whitespace-nowrap">{envsDir}/&lt;env-name&gt;/</span>
          {LAYOUT.map((l) => (
            <span key={l.file} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 pl-3">
              <span>{l.file}</span>
              <span className="text-muted-foreground">{l.hint}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          폴더를 만들고 Rescan 하면 목록에 나타납니다. 폴더 위치는 스테이션 <code className="font-mono">.env</code> 의{" "}
          <code className="font-mono">VLA_SIM_ENVS_DIR</code> 로 정합니다 (기본값 <code className="font-mono">sim/envs</code>).
        </p>
      </div>
    </details>
  )
}
