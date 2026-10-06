import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { SearchInput } from "@/components/common/search-input"
import { Segmented } from "@/components/common/segmented"
import { EnvThumb } from "@/components/robot/env-thumb"
import { useRigs } from "@/api/rigs"
import { useSimConfig } from "@/api/simulation"
import { useTasks } from "@/api/tasks"
import type { SimEnv } from "@/domain/simulation"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { ANY_RIG, formatKB, rigLabel, rigOf, type RigFilter } from "../lib"

/** Left-hand list of the environments in the environments folder, filtered by rig */
export function EnvList({
  envs,
  selected,
  onSelect,
  rig,
  onRigChange,
}: {
  envs: SimEnv[]
  selected?: string
  onSelect: (id: string) => void
  rig: RigFilter
  onRigChange: (rig: RigFilter) => void
}) {
  const [search, setSearch] = useState("")
  const envsDir = useSimConfig().data?.envsDir
  const tasks = useTasks().data ?? []
  const rigs = useRigs().data ?? []
  const q = search.trim().toLowerCase()
  const shown = envs.filter((e) => (rig === "all" || rigOf(e) === rig) && (!q || e.name.toLowerCase().includes(q) || e.id.includes(q)))
  const count = (r: string) => envs.filter((e) => rigOf(e) === r).length
  // Rig folders found on disk that no rig file declares still get a tab
  const rigIds = [...new Set([...rigs.map((r) => r.id), ...envs.flatMap((e) => (e.rigId ? [e.rigId] : []))])]

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
      <Segmented
        label="Rig"
        fill
        className="overflow-x-auto"
        value={rig}
        onChange={onRigChange}
        options={[
          { value: "all", label: "All", count: envs.length },
          ...rigIds.map((id) => ({ value: id, label: rigLabel(id, rigs), count: count(id) })),
          { value: ANY_RIG, label: "Any rig", count: count(ANY_RIG) },
        ]}
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
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <EnvThumb env={e} className="w-16" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{e.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{e.scene}</span>, {formatKB(e.sizeKB)}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground/80">
                    {rigLabel(e.rigId, rigs)}
                    {used > 0 && ` · ${plural(used, "task")}`}
                  </span>
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
