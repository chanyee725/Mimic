import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { SearchInput } from "@/components/common/search-input"
import type { SimAsset } from "@/domain/simulation"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

import { formatKB } from "../lib"

export function AssetList({
  title,
  dir,
  assets,
  selected,
  onSelect,
  envCount,
}: {
  title: string
  dir: string
  assets: SimAsset[]
  selected?: string
  onSelect: (id: string) => void
  /** Environments tagged with a robot (robots only) */
  envCount?: (id: string) => number
}) {
  const [search, setSearch] = useState("")
  const q = search.trim().toLowerCase()
  const shown = assets.filter((a) => !q || a.id.toLowerCase().includes(q))

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          {title}
          <span className="font-normal text-muted-foreground tabular-nums">{assets.length}</span>
        </span>
      }
    >
      <p className="-mt-1 truncate px-2 font-mono text-xs text-muted-foreground">{dir}</p>
      <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}`} />
      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {shown.map((a) => {
          const on = a.id === selected
          const envs = envCount?.(a.id)
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(a.id)}
                className={cn(
                  "grid w-full gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <span className={cn("truncate font-mono text-[13px]", on ? "font-medium" : "font-normal")}>{a.id}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {plural(a.files.length, "file")}, {formatKB(a.sizeKB)}
                  {envs !== undefined && ` · ${plural(envs, "environment")}`}
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 항목이 없습니다.</li>}
      </ul>
    </Panel>
  )
}
