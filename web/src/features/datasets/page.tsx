import { useState } from "react"
import { Link } from "react-router-dom"
import {
  LuArrowRightLeft,
  LuClock,
  LuCloudUpload,
  LuCpu,
  LuFilm,
  LuHardDrive,
  LuListVideo,
  LuRotateCcw,
  LuSearch,
  LuTrash2,
} from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DATASETS, type Dataset, type DatasetKind, type DatasetStatus } from "@/dummy/datasets"
import { getRig } from "@/dummy/rigs"
import { getTask } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

import { DatasetThumb } from "./thumbnail"

const STATUS: Record<DatasetStatus, { tone: Tone; label: string }> = {
  ready: { tone: "ok", label: "Ready" },
  converting: { tone: "info", label: "Converting" },
  failed: { tone: "bad", label: "Failed" },
}

type Filter = "all" | DatasetKind
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lerobot", label: "LeRobot" },
  { id: "mcap", label: "MCAP" },
]
const KIND_LABEL: Record<DatasetKind, string> = { lerobot: "LeRobot", mcap: "MCAP" }
// 목록 점 색은 형식을 나타낸다 (상태는 상세 헤더와 아래 줄 글자로)
const KIND_DOT: Record<DatasetKind, string> = { lerobot: "bg-yellow-400", mcap: "bg-zinc-400" }

// 최근 것부터
const SORTED = [...DATASETS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

const minutes = (sec: number) => (sec >= 60 ? `${(sec / 60).toFixed(1)} min` : `${sec.toFixed(0)} s`)

function DatasetList({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const byKind = (f: Filter) => SORTED.filter((d) => f === "all" || d.kind === f)
  const shown = byKind(filter).filter((d) => !q || d.repoId.toLowerCase().includes(q) || d.taskId.includes(q))

  return (
    <Panel
      className="@container gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Datasets
          <span className="font-normal text-muted-foreground tabular-nums">{DATASETS.length}</span>
        </span>
      }
    >
      <div className="relative">
        <LuSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search datasets or tasks"
          aria-label="Search datasets"
          className="h-8 border-transparent bg-muted pl-8 text-[13px]"
        />
      </div>
      <div className="grid grid-cols-3 rounded-md bg-muted p-0.5" role="tablist" aria-label="Format">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-7 rounded-[5px] text-xs transition-colors",
              filter === f.id ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.id !== "all" && (
              <span className={cn("mr-1.5 inline-block size-1.5 rounded-full align-middle", KIND_DOT[f.id])} aria-hidden />
            )}
            {f.label}
            <span className="ml-1 text-muted-foreground tabular-nums">{byKind(f.id).length}</span>
          </button>
        ))}
      </div>

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
                <DatasetThumb taskId={d.taskId} className="w-20" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[d.kind])} aria-hidden />
                    <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{d.repoId}</span>
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                    {KIND_LABEL[d.kind]},{" "}
                    {d.status === "converting"
                      ? `converting ${d.progress}%`
                      : d.status === "failed"
                        ? "conversion failed"
                        : `${d.episodes.length} episodes, ${d.sizeGB} GB`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 데이터셋이 없습니다.</li>}
      </ul>
    </Panel>
  )
}

function DatasetDetail({ dataset }: { dataset: Dataset }) {
  const task = getTask(dataset.taskId)
  const rig = getRig(dataset.rigId)
  const frames = dataset.episodes.reduce((a, e) => a + e.frames, 0)
  const lengthS = dataset.episodes.reduce((a, e) => a + e.lengthS, 0)
  const status = STATUS[dataset.status]

  return (
    <Panel className="min-h-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <DatasetThumb taskId={dataset.taskId} className="w-32" />
          <div className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="truncate text-lg font-semibold">{dataset.repoId}</h2>
              <StatusDot tone={status.tone} className="shrink-0 text-[13px]">
                {status.label}
              </StatusDot>
            </div>
            <p className="truncate text-[13px] text-muted-foreground">{task?.instruction ?? dataset.taskId}</p>
            <p className="truncate text-xs text-muted-foreground">
              {rig.name}, {dataset.format}
              {dataset.kind === "lerobot" && `, ${dataset.fps} fps`}, created {dataset.createdAt}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={dataset.status !== "ready" || dataset.hub.pushed}>
            <LuCloudUpload />
            {dataset.hub.pushed ? "On HF Hub (private)" : "Push to HF Hub"}
          </Button>
          {dataset.kind === "lerobot" ? (
            <Link
              to="/training"
              className={cn(buttonVariants({ size: "sm" }), dataset.status !== "ready" && "pointer-events-none opacity-50")}
              aria-disabled={dataset.status !== "ready"}
            >
              <LuCpu />
              Train with this
            </Link>
          ) : (
            <Link to="/convert" className={buttonVariants({ size: "sm" })}>
              <LuArrowRightLeft />
              Convert to LeRobot
            </Link>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Delete dataset" title="Delete dataset" className="text-bad hover:text-bad">
            <LuTrash2 />
          </Button>
        </div>
      </div>

      {dataset.status === "converting" && (
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>Encoding videos and writing parquet files</span>
            <span>{dataset.progress}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Conversion progress"
            aria-valuenow={dataset.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-info" style={{ width: `${dataset.progress}%` }} />
          </div>
        </div>
      )}

      {dataset.status === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-bad-muted px-3 py-2.5 text-[13px] text-bad">
          <span>영상 인코딩 중 디스크 공간이 부족해 변환이 중단됐습니다. 공간을 확보한 뒤 다시 시도하세요.</span>
          <Link to="/convert" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background")}>
            <LuRotateCcw />
            Convert again
          </Link>
        </div>
      )}

      {dataset.episodes.length > 0 && (
        <StatStrip
          items={[
            { label: "Episodes", value: dataset.episodes.length, icon: LuListVideo },
            { label: dataset.kind === "mcap" ? "Video frames" : "Frames", value: frames.toLocaleString(), icon: LuFilm },
            { label: "Length", value: minutes(lengthS), icon: LuClock },
            { label: "Size", value: `${dataset.sizeGB} GB`, icon: LuHardDrive },
          ]}
        />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col gap-2">
          <h3 className="text-sm font-semibold">{dataset.kind === "mcap" ? "Topics" : "Features"}</h3>
          <div className="min-h-0 overflow-auto rounded-md border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-normal">{dataset.kind === "mcap" ? "Topic" : "Key"}</th>
                  <th className="px-3 py-2 font-normal">{dataset.kind === "mcap" ? "Schema" : "Type"}</th>
                  <th className="px-3 py-2 font-normal">{dataset.kind === "mcap" ? "Rate" : "Shape"}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dataset.features.map((f) => (
                  <tr key={f.key}>
                    <td className="max-w-56 px-3 py-1.5">
                      <span className="block truncate">{f.key}</span>
                      {f.note && <span className="block truncate text-[11px] text-muted-foreground">{f.note}</span>}
                    </td>
                    <td className="max-w-36 truncate px-3 py-1.5 text-muted-foreground" title={f.dtype}>
                      {f.dtype}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground tabular-nums">{f.shape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-2">
          <h3 className="text-sm font-semibold">Episodes</h3>
          {dataset.episodes.length === 0 ? (
            <p className="rounded-md border border-dashed py-6 text-center text-[13px] text-muted-foreground">
              변환된 에피소드가 없습니다.
            </p>
          ) : (
            <ul className="min-h-0 divide-y overflow-y-auto rounded-md border">
              {dataset.episodes.map((e) => (
                <li key={e.index} className="grid grid-cols-[3rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-1.5 text-[13px]">
                  <span className="text-muted-foreground tabular-nums">#{e.index}</span>
                  <span className="truncate">{e.source.split("/").pop()}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{e.lengthS.toFixed(1)} s</span>
                  <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">{e.frames} frames</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  )
}

export function DatasetsPage() {
  const [selected, setSelected] = useState(SORTED[0].repoId)
  const dataset = DATASETS.find((d) => d.repoId === selected) ?? SORTED[0]

  return (
    <Page fit title="Datasets" description="변환한 LeRobot 데이터셋과 원본 MCAP 묶음을 확인하고 HF Hub 에 올리거나 학습에 사용합니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <DatasetList selected={dataset.repoId} onSelect={setSelected} />
        <DatasetDetail dataset={dataset} />
      </div>
    </Page>
  )
}
