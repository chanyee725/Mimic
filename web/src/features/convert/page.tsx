import { useState } from "react"
import { Link } from "react-router-dom"
import { LuChevronRight, LuPlay } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ALIGNMENT_MODES } from "@/dummy/convert"
import type { McapTopic, Recording } from "@/dummy/recordings"
import { getRig } from "@/dummy/rigs"
import { TASKS, getTask, type Alignment } from "@/dummy/tasks"
import { useRecordings } from "@/lib/recordings-store"
import { cn } from "@/lib/utils"

const SKIP = "skip"

/** 우리 녹화 파일은 Rig 메타데이터가 있으므로 토픽 종류로 feature 를 자동으로 정한다 */
function autoFeature(t: McapTopic, rec: Recording): string {
  if (rec.source !== "capture") return SKIP
  switch (t.kind) {
    case "action":
      return "action"
    case "state":
      return "observation.state"
    case "video":
      return `observation.images.${t.name.match(/^\/cam_([^/]+)/)?.[1] ?? "main"}`
    case "label":
      return t.name.endsWith("subtask") ? "subtask_index" : SKIP
    default:
      return SKIP
  }
}

/** 막대를 개별로 그리는 최대 개수. 넘으면 연속된 에피소드를 묶어 한 막대로 그린다 */
const MAX_BARS = 60
const TICK_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600]

const fmtLength = (sec: number) => (sec < 3600 ? `${(sec / 60).toFixed(1)} min` : `${(sec / 3600).toFixed(1)} h`)
const fmtSize = (mb: number) => (mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(1)} GB`)
const PICKER_PAGE = 50

const secLabel = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${s / 60}m` : `${s / 3600}h`)

/** 승인된 에피소드 길이 막대. 개별 막대를 누르면 변환 대상에서 빼거나 다시 넣는다 */
function EpisodeStrip({
  episodes,
  excluded,
  onToggle,
  summary,
}: {
  episodes: Recording[]
  excluded: Set<string>
  onToggle: (id: string) => void
  summary: string
}) {
  if (episodes.length === 0) return <div className="min-h-16 flex-1 rounded-md border border-dashed" />

  // 세로축: 최대 4칸이 되는 눈금 간격을 고른다
  const longest = Math.max(...episodes.map((r) => r.durationS))
  const step = TICK_STEPS.find((t) => longest / t <= 4) ?? 3600
  const top = Math.ceil(longest / step) * step
  const ticks = Array.from({ length: top / step }, (_, i) => (i + 1) * step)
  const pct = (sec: number) => `${(sec / top) * 100}%`

  const name = (r: Recording) => r.file.split("/").pop()!.replace(".mcap", "")
  const per = Math.ceil(episodes.length / MAX_BARS)
  const groups = Array.from({ length: Math.ceil(episodes.length / per) }, (_, i) => episodes.slice(i * per, (i + 1) * per))

  return (
    <div className="grid min-h-16 flex-1 grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5">
      {/* 세로축 시간 눈금 */}
      <div className="relative w-7 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        {[0, ...ticks].map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: pct(t) }}>
            {secLabel(t)}
          </span>
        ))}
      </div>
      <div className="relative flex min-h-0 items-end justify-between gap-px border-b" role="group" aria-label="Episode lengths">
        {ticks.map((t) => (
          <span key={t} className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ bottom: pct(t) }} aria-hidden />
        ))}
        {per === 1
          ? episodes.map((r) => {
              const on = !excluded.has(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${name(r)}, ${r.durationS.toFixed(1)} s`}
                  title={`${name(r)}, ${r.durationS.toFixed(1)} s${on ? "" : " (excluded)"}`}
                  onClick={() => onToggle(r.id)}
                  className="group relative flex h-full max-w-6 min-w-1 flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span
                    className={cn(
                      "w-full max-w-2 rounded-t-sm transition-colors",
                      on ? "bg-foreground/70 group-hover:bg-foreground" : "bg-foreground/10 group-hover:bg-foreground/25",
                    )}
                    style={{ height: pct(r.durationS) }}
                  />
                </button>
              )
            })
          : groups.map((g) => {
              // 묶음 막대: 연한 부분은 최소~최대 범위, 진한 부분은 선택된 에피소드의 평균
              const picked = g.filter((r) => !excluded.has(r.id))
              const lens = g.map((r) => r.durationS)
              const mean = picked.length ? picked.reduce((a, r) => a + r.durationS, 0) / picked.length : 0
              return (
                <span
                  key={g[0].id}
                  title={`${name(g[0])} – ${name(g[g.length - 1])}\n${picked.length}/${g.length} selected, mean ${mean.toFixed(1)} s, range ${Math.min(...lens).toFixed(1)}–${Math.max(...lens).toFixed(1)} s`}
                  className="relative h-full max-w-2 min-w-px flex-1"
                >
                  <span
                    className="absolute inset-x-0 rounded-sm bg-foreground/15"
                    style={{ bottom: pct(Math.min(...lens)), height: `calc(${pct(Math.max(...lens))} - ${pct(Math.min(...lens))})` }}
                  />
                  <span className="absolute inset-x-0 bottom-0 rounded-t-sm bg-foreground/70" style={{ height: pct(mean) }} />
                </span>
              )
            })}
      </div>
      <span />
      <div className="flex justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
        <span>{name(episodes[0])}</span>
        <span className="truncate text-foreground">
          {summary}
          {per > 1 && <span className="text-muted-foreground">, {per.toLocaleString()} episodes per bar</span>}
        </span>
        <span>{name(episodes[episodes.length - 1])}</span>
      </div>
    </div>
  )
}

export function ConvertPage() {
  const recordings = useRecordings()
  const [taskId, setTaskId] = useState<string>(TASKS[0].id)
  const task = getTask(taskId)
  const pool = recordings.filter((r) => r.taskId === taskId)
  const accepted = pool.filter((r) => r.review === "accepted")
  const pending = pool.filter((r) => r.review === "pending").length

  // 기본은 승인된 에피소드 전부. Task 를 바꾸면 다시 전부 선택
  const [excluded, setExcluded] = useState<string[]>([])
  const [mode, setMode] = useState<Alignment>(task?.alignment ?? "chunk")
  const [repoId, setRepoId] = useState(task?.repoId ?? "")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPage, setPickerPage] = useState(0)

  const changeTask = (id: string) => {
    setTaskId(id)
    setExcluded([])
    setPickerPage(0)
    setMode(getTask(id)?.alignment ?? "chunk")
    setRepoId(getTask(id)?.repoId ?? "")
  }

  const skip = new Set(excluded)
  const targets = accepted.filter((r) => !skip.has(r.id))
  const pages = Math.ceil(accepted.length / PICKER_PAGE)
  const toggle = (id: string) => setExcluded((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const fps = ALIGNMENT_MODES.find((m) => m.id === mode)!.fps
  const topics = new Map<string, { topic: McapTopic; rec: Recording }>()
  for (const r of targets.length ? targets : accepted)
    for (const t of r.topics) if (!topics.has(t.name)) topics.set(t.name, { topic: t, rec: r })
  // feature 는 Rig 정보로 자동 결정한다
  const included = [...topics.values()]
    .map(({ topic, rec }) => ({ topic, feature: autoFeature(topic, rec) }))
    .filter((m) => m.feature !== SKIP)
  const totalS = targets.reduce((a, r) => a + r.durationS, 0)
  const totalMB = targets.reduce((a, r) => a + r.sizeMB, 0)
  const rig = task ? getRig(task.rigId) : undefined

  const preview = [
    `fps: ${fps}`,
    "features:",
    ...included.map((m) =>
      m.feature === "action" && mode === "chunk"
        ? `  action: float32 [2, ${rig?.joints.length ?? 6}]`
        : `  ${m.feature}: ${m.topic.kind === "video" ? "video" : m.topic.kind === "label" ? "int64" : "float32"}`,
    ),
    ...(task ? [`task: ${task.instruction}`] : []),
  ].join("\n")

  return (
    <Page fit title="Convert" description="Task 를 골라 승인된 MCAP 에피소드를 LeRobot 데이터셋으로 변환합니다.">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── 왼쪽: 무엇을 어떻게 변환하나 (Task · Time alignment) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Task" className="min-h-0 flex-1 gap-3 overflow-y-auto">
            <Select value={taskId} onValueChange={(v) => v && changeTask(v as string)}>
              <SelectTrigger aria-label="Task" className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASKS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-[13px]">
                    {t.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <dl className="divide-y">
              <div className="grid gap-1 pb-3">
                <dt className="text-xs text-muted-foreground">Label</dt>
                <dd className="text-[13px] leading-relaxed">{task?.instruction}</dd>
              </div>
              {rig && (
                <div className="flex justify-between gap-3 py-2.5 text-[13px]">
                  <dt className="text-muted-foreground">Rig</dt>
                  <dd>
                    {rig.name}, {rig.joints.length} DoF
                  </dd>
                </div>
              )}
              <div className="py-1">
                <dt className="sr-only">Episodes</dt>
                <dd>
                  <button
                    type="button"
                    disabled={accepted.length === 0}
                    onClick={() => setPickerOpen(true)}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none"
                  >
                    <span className="text-muted-foreground">Episodes</span>
                    <span className="flex items-center gap-1.5 tabular-nums">
                      {targets.length.toLocaleString()} of {accepted.length.toLocaleString()} accepted
                      <LuChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                </dd>
              </div>
            </dl>
            <EpisodeStrip episodes={accepted} excluded={skip} onToggle={toggle} summary={`${fmtLength(totalS)}, ${fmtSize(totalMB)}`} />
            {(accepted.length === 0 || pending > 0) && (
              <p className="text-xs text-muted-foreground">
                {accepted.length === 0 ? "승인된 에피소드가 없습니다. " : `검수를 기다리는 에피소드가 ${pending}개 있습니다. `}
                <Link to="/review" className="text-foreground underline underline-offset-4">
                  Review 에서 검수하기
                </Link>
              </p>
            )}
          </Panel>
          <Panel
            title="Time alignment"
            className="shrink-0"
            action={<span className="text-[13px] text-muted-foreground">Dataset fps {fps}</span>}
          >
            <ul className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Time alignment">
              {ALIGNMENT_MODES.map((m) => {
                const on = m.id === mode
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "grid h-full w-full grid-cols-[16px_minmax(0,1fr)] content-start items-start gap-x-2.5 gap-y-2 rounded-md border p-3 text-left transition-colors hover:bg-accent/60",
                        on && "border-foreground/40 bg-accent hover:bg-accent",
                      )}
                    >
                      <span
                        className={cn("mt-0.5 grid size-4 place-items-center rounded-full border", on && "border-foreground")}
                        aria-hidden
                      >
                        {on && <span className="size-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-[13px] font-medium">{m.title}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </span>
                      <span className="col-start-2 text-xs text-muted-foreground tabular-nums">{m.spec}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </section>

        {/* ── 오른쪽: 결과 (Output · Convert) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Output" className="min-h-0 flex-1">
            <div className="grid gap-1.5">
              <Label htmlFor="repo" className="text-xs font-normal text-muted-foreground">
                Dataset name
              </Label>
              <Input
                id="repo"
                className="h-9 text-[13px]"
                value={repoId}
                placeholder="local/my_dataset"
                onChange={(e) => setRepoId(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="format" className="text-xs font-normal text-muted-foreground">
                Format
              </Label>
              {/* 지금은 LeRobot 만 지원. 변환하지 않으면 원본 MCAP 을 그대로 올린다 */}
              <Select value="LeRobot v3.0">
                <SelectTrigger id="format" className="h-9 w-full text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LeRobot v3.0" className="text-[13px]">
                    LeRobot v3.0
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Features</span>
              <pre className="min-h-24 flex-1 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {preview}
              </pre>
            </div>
            <Button size="lg" className="w-full" disabled={targets.length === 0 || !repoId.trim()}>
              <LuPlay />
              Convert {targets.length.toLocaleString()} {targets.length === 1 ? "episode" : "episodes"}
            </Button>
          </Panel>
        </section>
      </div>

      {/* ── 에피소드 선택 모달 ── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-3 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose episodes</DialogTitle>
            <DialogDescription>{task?.id} 의 승인된 에피소드 중 변환할 것을 고릅니다. 기본은 전부 선택입니다.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {targets.length.toLocaleString()} of {accepted.length.toLocaleString()} selected
            </span>
            <span className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setExcluded([])}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setExcluded(accepted.map((r) => r.id))}>
                Clear
              </Button>
            </span>
          </div>
          <ul className="-mx-2 grid max-h-80 content-start gap-0.5 overflow-y-auto">
            {accepted.slice(pickerPage * PICKER_PAGE, (pickerPage + 1) * PICKER_PAGE).map((r) => {
              const on = !skip.has(r.id)
              return (
                <li key={r.id}>
                  <Label className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-accent/60">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) => setExcluded((ids) => (v === true ? ids.filter((x) => x !== r.id) : [...ids, r.id]))}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{r.file.split("/").pop()}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.durationS.toFixed(1)} s</span>
                    <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{r.sizeMB} MB</span>
                  </Label>
                </li>
              )
            })}
          </ul>
          <DialogFooter className="items-center sm:justify-between">
            {pages > 1 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                <Button variant="outline" size="sm" className="h-7" disabled={pickerPage === 0} onClick={() => setPickerPage((n) => n - 1)}>
                  Prev
                </Button>
                {pickerPage + 1} / {pages}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={pickerPage >= pages - 1}
                  onClick={() => setPickerPage((n) => n + 1)}
                >
                  Next
                </Button>
              </div>
            ) : (
              <span />
            )}
            <DialogClose render={<Button />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
