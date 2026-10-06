import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { SearchInput } from "@/components/common/search-input"
import { useSimConfig } from "@/api/simulation"
import { useTasks } from "@/api/tasks"
import type { SimEnv } from "@/domain/simulation"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { formatKB } from "../lib"

/** Left-hand list of the environments in the environments folder */
export function EnvList({ envs, selected, onSelect }: { envs: SimEnv[]; selected?: string; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("")
  const envsDir = useSimConfig().data?.envsDir
  const tasks = useTasks().data ?? []
  const q = search.trim().toLowerCase()
  const shown = envs.filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.includes(q))

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Environments
          <span className="font-normal text-muted-foreground tabular-nums">{envs.length}</span>
        </span>
      }
    >
      <p className="-mt-1 truncate px-2 font-mono text-xs text-muted-foreground" title={envsDir}>
        {envsDir ?? "…"}
      </p>
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search environments"
        aria-label="Search environments"
      />
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {shown.map((e) => {
          const on = e.id === selected
          const used = tasks.filter((t) => t.envId === e.id).length
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(e.id)}
                className={cn(
                  "grid w-full gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{e.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  <span className="font-mono">{e.scene}</span>, {formatKB(e.sizeKB)}
                  {used > 0 && `, ${plural(used, "task")}`}
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 환경이 없습니다.</li>}
      </ul>
    </Panel>
  )
}
