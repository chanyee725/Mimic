import { useState } from "react"
import { Link } from "react-router-dom"
import { LuCloudUpload, LuDownload, LuFlaskConical, LuFootprints, LuHardDrive, LuTarget, LuTrash2, LuTrendingDown } from "react-icons/lu"

import { Segmented } from "@/components/app/segmented"
import { SearchInput } from "@/components/app/search-input"
import { Page, Panel } from "@/components/app/page"
import { HfBadge } from "@/components/app/hf-badge"
import { StatStrip } from "@/components/app/stat-strip"
import { Button, buttonVariants } from "@/components/ui/button"
import { MODELS, MODEL_FILES, successRate, type Model } from "@/dummy/models"
import { POLICY, POLICY_BASE } from "@/dummy/training"
import { formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"

type Filter = "all" | "local" | "hub"
const FILTERS: { id: Filter; label: string; fits: (m: Model) => boolean }[] = [
  { id: "all", label: "All", fits: () => true },
  { id: "local", label: "Local", fits: (m) => !!m.localPath },
  { id: "hub", label: "HF Hub", fits: (m) => !!m.hubRepo },
]

// 최근 저장한 것부터
const SORTED = [...MODELS].sort((a, b) => b.savedAt.localeCompare(a.savedAt))

function ModelList({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = SORTED.filter(FILTERS.find((f) => f.id === filter)!.fits).filter(
    (m) => !q || m.name.toLowerCase().includes(q) || m.taskId.includes(q) || m.dataset.includes(q),
  )

  return (
    <Panel
      className="gap-2 p-3"
      title={
        <span className="flex items-baseline gap-1.5 px-2 text-[13px] font-medium">
          Models
          <span className="font-normal text-muted-foreground tabular-nums">{MODELS.length}</span>
        </span>
      }
    >
      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search models or tasks"
        aria-label="Search models"
      />
      <Segmented
        label="Location"
        fill
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ value: f.id, label: f.label, count: MODELS.filter(f.fits).length }))}
      />

      <ul className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {shown.map((m) => {
          const on = m.id === selected
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(m.id)}
                className={cn(
                  "grid w-full gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                  on && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("truncate text-[13px]", on ? "font-medium" : "font-normal")}>{m.name}</span>
                  {m.localPath && <LuHardDrive className="size-3 shrink-0 text-muted-foreground" aria-label="Local" />}
                  {m.hubRepo && <HfBadge title={m.hubRepo} />}
                </span>
                <span className="truncate text-xs text-muted-foreground">{m.taskId}</span>
                <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                  Step {m.step.toLocaleString()}, loss {m.loss.toFixed(3)}, success {formatPct(successRate(m))}
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="py-8 text-center text-[13px] text-muted-foreground">일치하는 모델이 없습니다.</li>}
      </ul>
    </Panel>
  )
}

function ModelDetail({ model: m }: { model: Model }) {
  const rate = successRate(m)
  const details = [
    { k: "Task", v: m.taskId },
    { k: "Dataset", v: m.dataset },
    {
      k: "Trained by",
      v: (
        <Link to={`/training/${m.jobId}`} className="underline underline-offset-4 hover:text-foreground">
          {m.jobId}, step {m.step.toLocaleString()}
        </Link>
      ),
    },
    { k: "Base model", v: `${POLICY} (${POLICY_BASE})` },
    { k: "Saved", v: m.savedAt },
    { k: "Local folder", v: m.localPath ?? "Not on this station" },
    { k: "HF Hub", v: m.hubRepo ? `${m.hubRepo} (private)` : "Not uploaded" },
  ]

  return (
    <Panel className="min-h-0 gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
            <span className="truncate">{m.name}</span>
            {m.hubRepo && <HfBadge title={m.hubRepo} />}
          </h2>
          <p className="truncate text-[13px] text-muted-foreground">
            {m.dataset}, {m.jobId}, step {m.step.toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={!!m.hubRepo}>
            <LuCloudUpload />
            {m.hubRepo ? "On HF Hub" : "Push to HF Hub"}
          </Button>
          <Button variant="outline" size="sm">
            <LuDownload />
            Download
          </Button>
          <Link to={`/evaluate?model=${m.id}`} className={buttonVariants({ size: "sm" })}>
            <LuFlaskConical />
            Evaluate
          </Link>
          <Button variant="ghost" size="icon-sm" aria-label="Delete model" title="Delete model" className="text-bad hover:text-bad">
            <LuTrash2 />
          </Button>
        </div>
      </div>

      <StatStrip
        items={[
          { label: "Step", value: m.step.toLocaleString(), icon: LuFootprints },
          { label: "Train loss", value: m.loss.toFixed(3), icon: LuTrendingDown },
          {
            label: "Success rate",
            value: formatPct(rate),
            sub: m.evals.length ? `${m.evals.reduce((a, e) => a + e.trials, 0)} trials` : "not evaluated",
            icon: LuTarget,
          },
          { label: "Size", value: `${(m.sizeMB / 1024).toFixed(1)} GB`, icon: LuHardDrive },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">Details</h3>
          <dl className="divide-y rounded-md border px-3">
            {details.map((d) => (
              <div key={d.k} className="flex justify-between gap-4 py-2 text-[13px]">
                <dt className="shrink-0 text-muted-foreground">{d.k}</dt>
                <dd className="min-w-0 truncate text-right">{d.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid content-start gap-4">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Evaluations</h3>
            {m.evals.length === 0 ? (
              <p className="rounded-md border border-dashed py-5 text-center text-[13px] text-muted-foreground">
                아직 평가하지 않았습니다.{" "}
                <Link to={`/evaluate?model=${m.id}`} className="text-foreground underline underline-offset-4">
                  Evaluate 에서 돌려 보기
                </Link>
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {m.evals.map((e) => (
                  <li key={e.at} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
                    <span className="truncate">{e.instruction}</span>
                    <span className="text-right tabular-nums">
                      {e.success} / {e.trials}
                      <span className="text-muted-foreground"> ({formatPct(e.success / e.trials)})</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{e.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">Files</h3>
            <ul className="divide-y rounded-md border">
              {MODEL_FILES.map((f) => (
                <li key={f.path} className="flex justify-between gap-3 px-3 py-1.5 text-[13px]">
                  <span className="truncate">{f.path}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {f.sizeMB >= 1 ? `${f.sizeMB.toLocaleString()} MB` : "< 1 MB"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Panel>
  )
}

export function ModelsPage() {
  const [selected, setSelected] = useState(SORTED[0].id)
  const model = MODELS.find((m) => m.id === selected) ?? SORTED[0]

  return (
    <Page fit title="Models" description="학습에서 저장한 checkpoint 를 모델로 모아 보고, 평가하거나 HF Hub 에 올립니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <ModelList selected={model.id} onSelect={setSelected} />
        <ModelDetail model={model} />
      </div>
    </Page>
  )
}
