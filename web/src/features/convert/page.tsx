import { useState } from "react"
import { Link } from "react-router-dom"
import { LuPlay } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ALIGNMENT_MODES, RETARGET_OPTIONS } from "@/dummy/convert"
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
    case "glove":
      return `observation.hand.${t.name.split("/").pop()}`
    default:
      return SKIP
  }
}

const IMPORTED = "__imported__"

export function ConvertPage() {
  const recordings = useRecordings()
  const [taskId, setTaskId] = useState<string>(TASKS[0].id)
  const task = getTask(taskId)
  const pool = recordings.filter((r) => (taskId === IMPORTED ? r.source === "external" : r.taskId === taskId))
  const accepted = pool.filter((r) => r.review === "accepted")
  const pending = pool.filter((r) => r.review === "pending").length

  // 기본은 승인된 에피소드 전부. Task 를 바꾸면 다시 전부 선택
  const [excluded, setExcluded] = useState<string[]>([])
  const [mode, setMode] = useState<Alignment>(task?.alignment ?? "chunk")
  const [push, setPush] = useState(true)

  const changeTask = (id: string) => {
    setTaskId(id)
    setExcluded([])
    setMode(getTask(id)?.alignment ?? "chunk")
  }

  const targets = accepted.filter((r) => !excluded.includes(r.id))
  const fps = ALIGNMENT_MODES.find((m) => m.id === mode)!.fps
  const topics = new Map<string, { topic: McapTopic; rec: Recording }>()
  for (const r of (targets.length ? targets : accepted)) for (const t of r.topics) if (!topics.has(t.name)) topics.set(t.name, { topic: t, rec: r })
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
    <Page
      title="Convert"
      description="Task 를 골라 승인된 MCAP 에피소드를 LeRobot 데이터셋으로 변환합니다."
      actions={
        <Button size="lg" disabled={targets.length === 0}>
          <LuPlay />
          Convert {targets.length} {targets.length === 1 ? "episode" : "episodes"}
        </Button>
      }
    >
      {/* ── Task ── */}
      <Panel className="gap-4">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="grid w-72 gap-1.5">
            <Label htmlFor="convert-task" className="text-xs text-muted-foreground">
              Task
            </Label>
            <Select value={taskId} onValueChange={(v) => v && changeTask(v as string)}>
              <SelectTrigger id="convert-task" className="h-9 w-full text-[13px]">
                <SelectValue>{task ? task.id : "Imported files"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TASKS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-[13px]">
                    {t.id}
                  </SelectItem>
                ))}
                <SelectItem value={IMPORTED} className="text-[13px]">
                  Imported files
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-64 flex-1 gap-1">
            <span className="text-xs text-muted-foreground">Label</span>
            <span className="truncate text-[13px]">
              {task ? task.instruction : "외부에서 가져온 MCAP 은 Task 정보가 없어 토픽을 직접 매핑합니다."}
            </span>
          </div>
          {rig && (
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Rig</span>
              <span className="text-[13px]">
                {rig.name}, {rig.joints.length} DoF
              </span>
            </div>
          )}
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Accepted</span>
            <span className="text-[13px] tabular-nums">
              {accepted.length} of {pool.length} recordings
            </span>
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-4">
          <Panel
            title="Episodes"
            action={
              pending > 0 ? (
                <Link to="/review" className="text-[13px] text-muted-foreground hover:text-foreground">
                  {pending} waiting for review
                </Link>
              ) : undefined
            }
          >
            {accepted.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted-foreground">
                승인된 에피소드가 없습니다. Review 에서 에피소드를 승인하면 여기서 변환할 수 있습니다.
              </p>
            ) : (
              <ul className="-mx-2 grid gap-0.5">
                {accepted.map((r) => {
                  const on = !excluded.includes(r.id)
                  return (
                    <li key={r.id}>
                      <Label className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 font-normal hover:bg-accent/60">
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) =>
                            setExcluded((ids) => (v === true ? ids.filter((x) => x !== r.id) : [...ids, r.id]))
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{r.file}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{r.durationS.toFixed(1)} s</span>
                        <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">{r.sizeMB} MB</span>
                      </Label>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Time alignment" action={<span className="text-[13px] text-muted-foreground">Dataset fps {fps}</span>}>
            <ul className="-mx-2 grid gap-0.5" role="radiogroup" aria-label="Time alignment">
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
                        "grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60",
                        on && "bg-accent hover:bg-accent",
                      )}
                    >
                      <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border", on && "border-foreground")} aria-hidden>
                        {on && <span className="size-2 rounded-full bg-foreground" />}
                      </span>
                      <span className="grid min-w-0 gap-0.5">
                        <span className="text-[13px] font-medium">{m.title}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{m.spec}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Output">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="repo">Output repo_id</Label>
                <Input
                  id="repo"
                  key={taskId}
                  className="h-9 text-[13px]"
                  defaultValue={task?.repoId ?? "local/imported_dataset"}
                />
              </div>
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
              <Label className="font-normal">
                <Checkbox checked={push} onCheckedChange={(v) => setPush(v === true)} />
                Push to HF Hub as private when done
              </Label>
            </div>
          </Panel>

          <Panel title="Summary">
            <dl className="divide-y">
              {[
                { k: "Episodes", v: String(targets.length) },
                { k: "Total length", v: `${(totalS / 60).toFixed(1)} min` },
                { k: "MCAP size", v: `${totalMB.toFixed(1)} MB` },
                { k: "Format", v: "LeRobot v3.0, AV1" },
              ].map((s) => (
                <div key={s.k} className="flex justify-between gap-3 py-2 text-[13px]">
                  <dt className="text-muted-foreground">{s.k}</dt>
                  <dd className="tabular-nums">{s.v}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Features preview</span>
              <pre className="rounded-md bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">{preview}</pre>
            </div>
          </Panel>
        </div>
      </section>

    </Page>
  )
}
