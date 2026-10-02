import { useState } from "react"
import { LuArrowRight, LuPlay } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ALIGNMENT_MODES, RAW_STREAMS, RETARGET_OPTIONS, type RawStream } from "@/dummy/convert"
import { getTask, type Alignment } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

const TASK = getTask("stack-two-blocks")!

/** 선택한 정렬 방식에 따라 LeRobot feature 이름과 변환 내용을 정한다. */
function mapStream(s: RawStream, mode: Alignment, fps: number) {
  switch (s.kind) {
    case "action":
      if (mode === "chunk") return { feature: "action [2,6]", transform: "chunk 2 samples" }
      return { feature: "action [6]", transform: mode === "duplicate" ? "as is" : "downsample" }
    case "state":
      if (mode === "chunk") return { feature: s.feature, transform: "sample at frame time" }
      return { feature: s.feature, transform: mode === "duplicate" ? "as is" : "downsample" }
    case "video":
      return { feature: s.feature, transform: mode === "duplicate" ? "duplicate frames" : "as is" }
    case "label":
      return { feature: s.feature, transform: "segment → per-frame" }
    case "glove":
      return {
        feature: s.feature,
        transform: `${s.raw.includes("tactile") ? "max-pool" : "interpolate"} → ${fps} Hz`,
      }
  }
}

function previewType(kind: RawStream["kind"], feature: string) {
  if (kind === "video") return "video"
  if (kind === "label") return "int64"
  if (feature.includes("[")) return "float32"
  return "float32 [6]"
}

export function ConvertPage() {
  const [mode, setMode] = useState<Alignment>("chunk")
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(RAW_STREAMS.map((s) => [s.raw, s.included])),
  )
  const [push, setPush] = useState(true)

  const current = ALIGNMENT_MODES.find((m) => m.id === mode)!
  const fps = current.fps
  const rows = RAW_STREAMS.map((s) => ({ ...s, ...mapStream(s, mode, fps), on: included[s.raw] }))
  const active = rows.filter((r) => r.on)
  const videoCount = active.filter((r) => r.kind === "video").length
  const estGb = (videoCount * (mode === "duplicate" ? 3.1 : 2.5) + 0.2).toFixed(1)

  const preview = [
    `fps: ${fps}`,
    "features:",
    ...active.map((r) => {
      const name = r.feature.replace(/ \[.*\]$/, "")
      const shape = r.feature.match(/\[.*\]$/)?.[0]
      return `  ${name}: ${shape ? `float32 ${shape}` : previewType(r.kind, r.feature)}`
    }),
    `task: ${TASK.instruction}`,
  ].join("\n")

  const summary = [
    { k: "Source", v: "3 sessions · 71 accepted" },
    { k: "Dataset fps", v: String(fps) },
    { k: "Format", v: "LeRobot v3.0" },
    { k: "Video codec", v: "AV1 · svt-av1" },
    { k: "Est. size", v: `≈ ${estGb} GB` },
  ]

  return (
    <Page
      fit
      title="Convert"
      description={
        <>
          Raw (MCAP, multi-rate) → LeRobotDataset · task <span className="font-mono">{TASK.id}</span>
        </>
      }
      actions={
        <Button size="lg">
          <LuPlay />
          Start conversion
        </Button>
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 flex-col gap-4">
          <Panel title="Time alignment" action={<span className="text-[13px] text-muted-foreground">action 60 Hz · video 30 fps</span>}>
            <ul className="-mx-2 divide-y" role="radiogroup" aria-label="Time alignment">
              {ALIGNMENT_MODES.map((m) => {
                const selected = m.id === mode
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50",
                        selected && "bg-muted/60 hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-4 place-items-center rounded-full border",
                          selected && "border-foreground",
                        )}
                        aria-hidden
                      >
                        {selected && <span className="size-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-sm font-semibold">{m.title}</span>
                        <span className="text-[13px] text-muted-foreground">{m.description}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{m.spec}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel
            title="Feature mapping"
            className="flex-1"
            action={<span className="text-[13px] text-muted-foreground">{active.length} / {rows.length} included</span>}
          >
            <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
              {rows.map((r) => (
                <li
                  key={r.raw}
                  className={cn(
                    "grid grid-cols-[20px_minmax(0,1.1fr)_56px_minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50",
                    !r.on && "opacity-55",
                  )}
                >
                  <Checkbox
                    checked={r.on}
                    onCheckedChange={(v) => setIncluded((prev) => ({ ...prev, [r.raw]: v === true }))}
                    aria-label={`Include ${r.raw}`}
                  />
                  <span className="truncate font-mono text-xs">{r.raw}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.rate}</span>
                  <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs font-medium">
                    <LuArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate">{r.feature}</span>
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">{r.transform}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <Panel title="Output">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Hand retargeting</Label>
                <Select defaultValue={RETARGET_OPTIONS[0]}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETARGET_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="repo">Output repo_id</Label>
                <Input id="repo" className="h-9 font-mono text-[13px]" defaultValue={TASK.repoId} />
              </div>
              <Label className="font-normal">
                <Checkbox checked={push} onCheckedChange={(v) => setPush(v === true)} />
                Push to HF Hub as private when done
              </Label>
            </div>
          </Panel>
          <Panel title="Summary" className="flex-1">
            {/* 높이가 부족하면 요약 전체가 패널 안에서 스크롤된다 */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              <dl className="shrink-0 divide-y">
                {summary.map((s) => (
                  <div key={s.k} className="flex justify-between gap-3 py-2 text-sm">
                    <dt className="text-muted-foreground">{s.k}</dt>
                    <dd className="font-mono text-[13px]">{s.v}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid shrink-0 gap-1.5">
                <span className="text-xs text-muted-foreground">Features preview</span>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {preview}
                </pre>
              </div>
              <div className="mt-auto grid shrink-0 gap-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Converting · ep 17 / 46</span>
                  <span className="font-mono">37%</span>
                </div>
                <div
                  className="h-1 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Conversion progress"
                  aria-valuenow={37}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-info" style={{ width: "37%" }} />
                </div>
                <span className="text-xs text-muted-foreground">2 videos encoding</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
