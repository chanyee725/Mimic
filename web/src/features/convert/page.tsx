import { useState } from "react"
import { Link } from "react-router-dom"
import { LuChevronRight, LuPlay } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { McapTopic, Recording } from "@/dummy/recordings"
import { getRig } from "@/dummy/rigs"
import { TASKS, getTask } from "@/dummy/tasks"
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

const fmtLength = (sec: number) => (sec < 3600 ? `${(sec / 60).toFixed(1)} min` : `${(sec / 3600).toFixed(1)} h`)
const fmtSize = (mb: number) => (mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(1)} GB`)
const PICKER_PAGE = 50

/** 짧거나 긴 에피소드: 중앙값의 절반 미만이거나 2배 초과 */
function lengthOutliers(episodes: Recording[]) {
  if (episodes.length < 3) return []
  const sorted = episodes.map((r) => r.durationS).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  return episodes.filter((r) => r.durationS < median * 0.5 || r.durationS > median * 2)
}

const failed = (r: Recording, label: string) => r.checks.some((c) => c.label === label && !c.ok)

const eps = (n: number) => `${n.toLocaleString()} ${n === 1 ? "episode" : "episodes"}`

type Check = { label: string; okText: string; bad: Recording[]; badText: (n: number) => string }

/** 변환 대상 요약과 변환 전 점검. 에피소드 수와 상관없이 같은 모양이다 */
function ConvertSummary({
  targets,
  fps,
  pending,
  onExclude,
}: {
  targets: Recording[]
  fps: number
  pending: number
  onExclude: (ids: string[]) => void
}) {
  if (targets.length === 0)
    return (
      <p className="rounded-md border border-dashed py-6 text-center text-[13px] text-muted-foreground">변환할 에피소드를 선택하세요.</p>
    )

  const lens = targets.map((r) => r.durationS)
  const totalS = lens.reduce((a, b) => a + b, 0)
  const totalMB = targets.reduce((a, r) => a + r.sizeMB, 0)
  const dates = targets.map((r) => r.recordedAt.slice(5, 10)).sort()
  const outliers = lengthOutliers(targets)

  const summary = [
    { k: "Frames", v: Math.round(totalS * fps).toLocaleString() },
    { k: "Length", v: fmtLength(totalS) },
    {
      k: "Avg episode",
      v: `${(totalS / targets.length).toFixed(1)} s`,
      sub: `${lens.reduce((a, b) => Math.min(a, b)).toFixed(1)} – ${lens.reduce((a, b) => Math.max(a, b)).toFixed(1)} s`,
    },
    { k: "Recorded", v: dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}` },
    // AV1 재인코딩 기준 대략치
    { k: "Est. output", v: `~${fmtSize(totalMB * 0.6)}`, sub: `MCAP ${fmtSize(totalMB)}` },
  ]

  const checks: Check[] = [
    {
      label: "Video frames",
      okText: "All complete",
      bad: targets.filter((r) => failed(r, "Video frames")),
      badText: (n) => `${eps(n)} with dropped frames`,
    },
    {
      label: "Timestamps",
      okText: "No gaps",
      bad: targets.filter((r) => failed(r, "Timestamp gap")),
      badText: (n) => `${eps(n)} with gaps over 50 ms`,
    },
    {
      label: "Subtasks",
      okText: "All labeled",
      bad: targets.filter((r) => failed(r, "Subtasks")),
      badText: (n) => `${eps(n)} missing subtasks`,
    },
    {
      label: "Length",
      okText: "No outliers",
      bad: outliers,
      badText: (n) => `${eps(n)} much shorter or longer than usual`,
    },
  ]

  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 @md:grid-cols-3 @2xl:grid-cols-5">
        {summary.map((m) => (
          <div key={m.k} className="grid content-start gap-0.5">
            <dt className="text-xs text-muted-foreground">{m.k}</dt>
            <dd className="text-[13px] whitespace-nowrap tabular-nums">
              {m.v}
              {m.sub && <span className="block text-xs text-muted-foreground">{m.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className="grid gap-1.5">
        <h3 className="text-xs text-muted-foreground">Checks</h3>
        <ul className="divide-y rounded-md border">
          {checks.map((c) => (
            <li key={c.label} className="flex min-h-10 items-center gap-3 px-3 py-1.5 text-[13px]">
              <StatusDot tone={c.bad.length ? "warn" : "ok"} className="w-28 shrink-0 text-[13px]">
                {c.label}
              </StatusDot>
              <span className={cn("min-w-0 flex-1 truncate", !c.bad.length && "text-muted-foreground")}>
                {c.bad.length ? c.badText(c.bad.length) : c.okText}
              </span>
              {c.bad.length > 0 && (
                <Button variant="outline" size="sm" className="h-7" onClick={() => onExclude(c.bad.map((r) => r.id))}>
                  Exclude
                </Button>
              )}
            </li>
          ))}
          {pending > 0 && (
            <li className="flex min-h-10 items-center gap-3 px-3 py-1.5 text-[13px]">
              <StatusDot tone="muted" className="w-28 shrink-0 text-[13px]">
                Review
              </StatusDot>
              <span className="min-w-0 flex-1 truncate">{eps(pending)} waiting for review</span>
              <Link to="/review" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7")}>
                Open
              </Link>
            </li>
          )}
        </ul>
      </section>
    </>
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
  const [repoId, setRepoId] = useState(task?.repoId ?? "")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPage, setPickerPage] = useState(0)

  const changeTask = (id: string) => {
    setTaskId(id)
    setExcluded([])
    setPickerPage(0)
    setRepoId(getTask(id)?.repoId ?? "")
  }

  const skip = new Set(excluded)
  const targets = accepted.filter((r) => !skip.has(r.id))
  const pages = Math.ceil(accepted.length / PICKER_PAGE)
  // LeRobot 은 fps 가 하나라 action 을 영상 fps 로 줄여 맞춘다 (원본 MCAP 은 그대로 남는다)
  const fps = task?.videoFps ?? 30
  const actionHz = task?.actionHz ?? 60
  const topics = new Map<string, { topic: McapTopic; rec: Recording }>()
  for (const r of targets.length ? targets : accepted)
    for (const t of r.topics) if (!topics.has(t.name)) topics.set(t.name, { topic: t, rec: r })
  // feature 는 Rig 정보로 자동 결정한다
  const included = [...topics.values()]
    .map(({ topic, rec }) => ({ topic, feature: autoFeature(topic, rec) }))
    .filter((m) => m.feature !== SKIP)
  const rig = task ? getRig(task.rigId) : undefined

  const preview = [
    `fps: ${fps}`,
    "features:",
    ...included.map((m) =>
      m.feature === "action" || m.feature === "observation.state"
        ? `  ${m.feature}: float32 [${rig?.joints.length ?? 6}]`
        : `  ${m.feature}: ${m.topic.kind === "video" ? "video" : m.topic.kind === "label" ? "int64" : "float32"}`,
    ),
    ...(task ? [`task: ${task.instruction}`] : []),
  ].join("\n")

  return (
    <Page fit title="Convert" description="Task 를 골라 승인된 MCAP 에피소드를 LeRobot 데이터셋으로 변환합니다.">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── 왼쪽: 무엇을 변환하나 (Task · 에피소드) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Task" className="@container min-h-0 flex-1 gap-4 overflow-y-auto">
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
            <ConvertSummary
              targets={targets}
              fps={fps}
              pending={pending}
              onExclude={(ids) => setExcluded((cur) => [...new Set([...cur, ...ids])])}
            />
            {accepted.length === 0 && (
              <p className="text-xs text-muted-foreground">
                승인된 에피소드가 없습니다.{" "}
                <Link to="/review" className="text-foreground underline underline-offset-4">
                  Review 에서 검수하기
                </Link>
              </p>
            )}
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
              <p className="text-xs text-muted-foreground tabular-nums">
                {fps} fps. Action {actionHz} Hz is downsampled to {fps} Hz to match the cameras.
              </p>
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
