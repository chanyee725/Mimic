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
import type { McapTopic, Recording } from "@/dummy/recordings"
import { getRig } from "@/dummy/rigs"
import { TASKS, getTask } from "@/dummy/tasks"
import { formatLength, formatSize, plural } from "@/lib/format"
import { useRecordings } from "@/lib/recordings-store"

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

const PICKER_PAGE = 50

/** 변환 대상 요약. 에피소드 수와 상관없이 같은 모양이다 */
function ConvertSummary({ targets, fps }: { targets: Recording[]; fps: number }) {
  if (targets.length === 0)
    return (
      <p className="rounded-md border border-dashed py-6 text-center text-[13px] text-muted-foreground">변환할 에피소드를 선택하세요.</p>
    )

  const lens = targets.map((r) => r.durationS)
  const totalS = lens.reduce((a, b) => a + b, 0)
  const totalMB = targets.reduce((a, r) => a + r.sizeMB, 0)
  const dates = targets.map((r) => r.recordedAt.slice(5, 10)).sort()
  const summary = [
    { k: "Frames", v: Math.round(totalS * fps).toLocaleString() },
    { k: "Length", v: formatLength(totalS) },
    {
      k: "Avg episode",
      v: `${(totalS / targets.length).toFixed(1)} s`,
      sub: `${lens.reduce((a, b) => Math.min(a, b)).toFixed(1)} – ${lens.reduce((a, b) => Math.max(a, b)).toFixed(1)} s`,
    },
    { k: "Recorded", v: dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}` },
    // AV1 재인코딩 기준 대략치
    { k: "Est. output", v: `~${formatSize(totalMB * 0.6)}`, sub: `MCAP ${formatSize(totalMB)}` },
  ]

  return (
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
    <Page title="Convert" description="Task 를 골라 승인된 MCAP 에피소드를 LeRobot 데이터셋으로 변환합니다.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ── 왼쪽: 무엇을 변환하나 (Task · 에피소드) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Task" className="@container flex-1 gap-4">
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
            <ConvertSummary targets={targets} fps={fps} />
            {(accepted.length === 0 || pending > 0) && (
              <p className="text-xs text-muted-foreground">
                {accepted.length === 0 ? "승인된 에피소드가 없습니다. " : `검수를 기다리는 에피소드가 ${pending}개 있습니다. `}
                <Link to="/review" className="text-foreground underline underline-offset-4">
                  Review 에서 검수하기
                </Link>
              </p>
            )}
          </Panel>
        </section>

        {/* ── 오른쪽: 결과 (Output · Convert) ── */}
        <section className="flex min-h-0 flex-col gap-4">
          <Panel title="Output" className="flex-1">
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
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Features</span>
              <pre className="flex-1 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {preview}
              </pre>
            </div>
            <Button size="lg" className="w-full" disabled={targets.length === 0 || !repoId.trim()}>
              <LuPlay />
              Convert {plural(targets.length, "episode")}
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
