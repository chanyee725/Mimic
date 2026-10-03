import { useState } from "react"
import type { UseQueryResult } from "@tanstack/react-query"
import { LuRefreshCw } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { SearchInput } from "@/components/common/search-input"
import { Segmented } from "@/components/common/segmented"
import { StatusDot } from "@/components/common/status-dot"
import { useRescanEnvs, useSimConfig } from "@/api/simulation"
import { useTasks } from "@/api/tasks"
import type { SimEnv } from "@/domain/simulation"
import { formatDateTime, plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { ENV_FILTERS, ENV_STATE, type EnvFilter } from "../envs"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { RegisterEnvHelp } from "./register-env-help"

/** Rescan button: the backend rescans the environments folder and the lists refetch */
function RescanButton({ rescan }: { rescan: ReturnType<typeof useRescanEnvs> }) {
  return (
    <span className="flex items-center gap-1.5">
      {rescan.data && !rescan.isPending && (
        <span className="text-xs text-muted-foreground" title={formatDateTime(rescan.data.scannedAt)}>
          Found {plural(rescan.data.envs.length, "environment")}
        </span>
      )}
      <Button variant="ghost" size="sm" disabled={rescan.isPending} onClick={() => rescan.mutate()}>
        <LuRefreshCw className={cn(rescan.isPending && "animate-spin")} />
        {rescan.isPending ? "Scanning…" : "Rescan"}
      </Button>
    </span>
  )
}

/** Left-hand list of environments found in the environments folder */
export function EnvList({
  query,
  selected,
  onSelect,
}: {
  query: UseQueryResult<SimEnv[]>
  selected?: string
  onSelect: (id: string) => void
}) {
  const [filter, setFilter] = useState<EnvFilter>("all")
  const [search, setSearch] = useState("")
  const rescan = useRescanEnvs()
  const envsDir = useSimConfig().data?.envsDir
  const tasks = useTasks().data ?? []
  const q = search.trim().toLowerCase()
  const envs = query.data ?? []
  const shown = envs
    .filter(ENV_FILTERS.find((f) => f.value === filter)!.fits)
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.includes(q) || (e.taskId ?? "").includes(q))

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Environments
          <span className="font-normal text-muted-foreground tabular-nums">{query.data && envs.length}</span>
        </span>
      }
      action={<RescanButton rescan={rescan} />}
    >
      <p className="-mt-1 truncate px-2 font-mono text-xs text-muted-foreground" title={envsDir}>
        {envsDir ?? "…"}
      </p>
      <ErrorNote error={rescan.error} />
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search environments or tasks"
        aria-label="Search environments"
      />
      <Segmented
        label="State"
        fill
        value={filter}
        onChange={setFilter}
        options={ENV_FILTERS.map((f) => ({ value: f.value, label: f.label, count: query.data && envs.filter(f.fits).length }))}
      />

      {query.isPending ? (
        <LoadingNote />
      ) : query.isError ? (
        <ErrorNote error={query.error} onRetry={query.refetch} />
      ) : (
        <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
          {shown.map((e) => {
            const on = e.id === selected
            const state = ENV_STATE[e.state]
            const task = e.taskId ? tasks.find((t) => t.id === e.taskId) : undefined
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
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{e.name}</span>
                    <StatusDot tone={state.tone} className="shrink-0 text-xs text-muted-foreground">
                      {state.label}
                    </StatusDot>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{e.id}</span>, {task?.name ?? e.taskId ?? "No task"}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
                    <span>{e.cameras.join(", ")}</span>
                    {!e.calibrated && <span className="text-warn">Not matched to rig</span>}
                  </span>
                </button>
              </li>
            )
          })}
          {shown.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 환경이 없습니다.</li>}
        </ul>
      )}

      <RegisterEnvHelp className="shrink-0" />
    </Panel>
  )
}
