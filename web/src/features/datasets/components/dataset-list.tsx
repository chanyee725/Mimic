import { useState } from "react"

import { HfBadge } from "@/components/common/hf-badge"
import { Panel } from "@/components/layout/page-layout"
import { SearchInput } from "@/components/common/search-input"
import { Segmented } from "@/components/common/segmented"
import { WorldMarks } from "@/components/robot/world-mark"
import { datasetWorlds, type Dataset } from "@/domain/dataset"
import { formatSize, plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { FILTERS, KIND_DOT, KIND_LABEL, type Filter } from "../lib"
import { DatasetThumb } from "./dataset-thumb"
import { QueryNote } from "@/components/common/query-state"

type ListQuery = { isPending: boolean; error: Error | null; refetch: () => unknown }

/** Datasets newest first (server order), filtered by format and search on the client — the list is small */
export function DatasetList({
  datasets: sorted,
  query: listQuery,
  selected,
  onSelect,
}: {
  datasets: Dataset[]
  query: ListQuery
  selected: string | undefined
  onSelect: (id: string) => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const loading = listQuery.isPending || !!listQuery.error
  const byKind = (f: Filter) => sorted.filter((d) => f === "all" || d.kind === f)
  const shown = byKind(filter).filter((d) => !q || d.repoId.toLowerCase().includes(q) || d.taskId.toLowerCase().includes(q))

  return (
    <Panel
      className="@container gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Datasets
          <span className="font-normal text-muted-foreground tabular-nums">{sorted.length}</span>
        </span>
      }
    >
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search datasets or tasks"
        aria-label="Search datasets"
      />
      <Segmented
        label="Format"
        fill
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({
          value: f.id,
          label: f.label,
          count: byKind(f.id).length,
          dot: f.id === "all" ? undefined : KIND_DOT[f.id],
        }))}
      />

      <ul className="-mx-1 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-1">
        {shown.map((d) => {
          const on = d.repoId === selected
          return (
            <li key={d.repoId}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(d.repoId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <DatasetThumb dataset={d} className="w-20" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[d.kind])} aria-hidden />
                    <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{d.repoId}</span>
                    {d.hub.pushed && <HfBadge />}
                    <WorldMarks worlds={datasetWorlds(d)} className="ml-auto" />
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {KIND_LABEL[d.kind]},{" "}
                    {d.status === "converting"
                      ? `${d.hub.pulled ? "downloading" : "converting"} ${d.progress}%`
                      : d.status === "failed"
                        ? d.hub.pulled
                          ? "download failed"
                          : "conversion failed"
                        : `${plural(d.episodeCount, "episode")}, ${formatSize(d.sizeGB * 1024)}`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {loading && (
          <li className="px-2 py-8 text-center">
            <QueryNote query={listQuery} />
          </li>
        )}
        {!loading && shown.length === 0 && (
          <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 데이터셋이 없습니다.</li>
        )}
      </ul>
    </Panel>
  )
}
