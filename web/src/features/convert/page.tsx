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

/** 승인된 에피소드 길이 막대. 막대를 누르면 변환 대상에서 빼거나 다시 넣는다 */
function EpisodeStrip({
  episodes,
  excluded,
  onToggle,
  summary,
}: {
  episodes: Recording[]
  excluded: string[]
  onToggle: (id: string) => void
  summary: string
}) {
  if (episodes.length === 0) return <div className="min-h-16 flex-1 rounded-md border border-dashed" />
  const max = Math.max(...episodes.map((r) => r.durationS))
  const name = (r: Recording) => r.file.split("/").pop()!.replace(".mcap", "")
  return (
    <div className="flex min-h-16 flex-1 flex-col gap-1.5">
      <div className="relative flex min-h-0 flex-1 items-end justify-between gap-1 border-b" role="group" aria-label="Episode lengths">
        {/* 25% 간격 보조선 */}
        {[25, 50, 75, 100].map((y) => (
          <span key={y} className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ bottom: `${y}%` }} aria-hidden />
        ))}
        {episodes.map((r) => {
          const on = !excluded.includes(r.id)
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={on}
              aria-label={`${name(r)}, ${r.durationS.toFixed(1)} s`}
              title={`${name(r)}, ${r.durationS.toFixed(1)} s${on ? "" : " (excluded)"}`}
              onClick={() => onToggle(r.id)}
              className="group relative flex h-full max-w-6 min-w-2 flex-1 items-end justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span
                className={cn(
                  "w-2 rounded-t-sm transition-colors",
                  on ? "bg-foreground/70 group-hover:bg-foreground" : "bg-foreground/10 group-hover:bg-foreground/25",
                )}
                style={{ height: `${(r.durationS / max) * 100}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{name(episodes[0])}</span>
        <span className="text-foreground">{summary}</span>
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

  const changeTask = (id: string) => {
    setTaskId(id)
    setExcluded([])
    setMode(getTask(id)?.alignment ?? "chunk")
    setRepoId(getTask(id)?.repoId ?? "")
  }

  const targets = accepted.filter((r) => !excluded.includes(r.id))
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
                      {targets.length} of {accepted.length} accepted
                      <LuChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                    </span>
                  </button>
                </dd>
              </div>
            </dl>
            <EpisodeStrip
              episodes={accepted}
              excluded={excluded}
              onToggle={toggle}
              summary={`${(totalS / 60).toFixed(1)} min, ${totalMB.toFixed(1)} MB`}
            />
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
            <div className="flex justify-between gap-3 border-y py-2.5 text-[13px]">
              <span className="text-muted-foreground">Format</span>
              <span>LeRobot v3.0, AV1</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Features</span>
              <pre className="min-h-24 flex-1 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
                {preview}
              </pre>
            </div>
            <Button size="lg" className="w-full" disabled={targets.length === 0 || !repoId.trim()}>
              <LuPlay />
              Convert {targets.length} {targets.length === 1 ? "episode" : "episodes"}
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
              {targets.length} of {accepted.length} selected
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
            {accepted.map((r) => {
              const on = !excluded.includes(r.id)
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
          <DialogFooter>
            <DialogClose render={<Button />}>Done</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
