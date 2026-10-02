import { useEffect, useState } from "react"
import { LuCircle, LuSquare } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { ProgressRing } from "@/components/app/progress-ring"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { devicesOf, type DeviceStream } from "@/dummy/devices"
import { getRig } from "@/dummy/rigs"
import { TASKS } from "@/dummy/tasks"
import { cn } from "@/lib/utils"
import { JointPlots } from "@/components/robot/joint-plots"
import { TaskPicker } from "@/components/app/task-picker"
import { VideoTile } from "@/components/robot/video-tile"
import { useEpisode, type Phase } from "./use-episode"

// 상단 Task 요약 패널 노출 여부 (레이아웃 정리 중이라 잠시 끔)
const SHOW_TASK_SUMMARY = false

const PHASE: Record<Phase, { label: string; className: string }> = {
  idle: { label: "READY", className: "bg-muted text-muted-foreground" },
  recording: { label: "REC", className: "bg-bad-muted text-bad" },
  review: { label: "REVIEW", className: "bg-warn-muted text-warn" },
}

function rateTone(s: DeviceStream): Tone {
  if (s.measuredHz === null || s.targetHz === null) return "muted"
  return s.measuredHz >= s.targetHz * 0.98 ? "ok" : "warn"
}

/** 카메라 타임코드 mm:ss:ff */
function timecode(ms: number, fps: number) {
  const totalFrames = Math.floor((ms / 1000) * fps)
  const ff = totalFrames % fps
  const sec = Math.floor(totalFrames / fps)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}:${pad(ff)}`
}

function fmt(ms: number) {
  const sec = Math.floor(ms / 1000)
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable)

export function CapturePage() {
  const [taskId, setTaskId] = useState(TASKS[0].id)
  const task = TASKS.find((t) => t.id === taskId) ?? TASKS[0]
  const rig = getRig(task.rigId)

  const ep = useEpisode({
    durationS: task.durationS,
    startEpisode: task.collected + 1,
    subtasksTotal: task.subtasks.length,
    actionHz: task.actionHz,
    videoFps: task.videoFps,
  })
  const { phase, toggle, save, start, discard, setSubtask } = ep

  const rigDevices = devicesOf(rig.id)
  const cameras = rigDevices.filter((d) => d.type === "camera")

  const streams = rigDevices
    .filter((d) => d.type !== "input")
    .flatMap((d) => d.streams.map((s) => ({ ...s, key: s.key.replace(/^(images|hand)\./, "") })))

  // 작업자는 양손으로 leader 암을 잡고 있으므로 키보드 / 풋 페달 입력이 기본
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.repeat) return
      if (e.code === "Space") {
        e.preventDefault()
        toggle()
      } else if (e.key === "ArrowRight") save("success")
      else if (e.key === "f" || e.key === "F") save("fail")
      else if (e.key === "p" || e.key === "P") save("partial")
      else if (e.key === "ArrowLeft") {
        if (phase !== "idle") start()
      } else if (e.key === "Escape") discard()
      else if (phase === "recording") {
        const idx = task.subtasks.findIndex((s) => s.key === e.key)
        if (idx >= 0) setSubtask(idx)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle, save, start, discard, setSubtask, phase, task.subtasks])

  const pct = Math.min(100, (ep.elapsedMs / (task.durationS * 1000)) * 100)
  const recording = phase === "recording"
  // 이번 세션에서 저장한 에피소드까지 포함한 수집 진행도
  const collected = ep.episode - 1
  const progressPct = Math.min(100, Math.round((collected / task.targetEpisodes) * 100))

  return (
    <Page
      fit
      title="Capture"
      description={`${rig.name}: ${rig.master} drives ${rig.slave}. Action ${task.actionHz} Hz, video ${task.videoFps} fps.`}
    >
      {/* Task 요약 (Task · Instruction · Episode · Duration · Subtask · Streams) — 잠시 숨김 */}
      {SHOW_TASK_SUMMARY && (
      <Panel className="shrink-0 gap-4">
        <div className="flex flex-wrap items-end gap-5">
          <div className="grid w-56 gap-1.5">
            <Label htmlFor="capture-task" className="text-xs text-muted-foreground">
              Task
            </Label>
            <Select value={taskId} onValueChange={(v) => v && setTaskId(v as string)} disabled={phase !== "idle"}>
              <SelectTrigger id="capture-task" className="h-9 w-full font-mono text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASKS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="font-mono text-[13px]">
                    {t.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-64 flex-1 gap-1.5">
            <span className="text-xs text-muted-foreground">Instruction</span>
            <div className="flex h-9 items-center truncate rounded-md bg-muted px-3 text-sm">{task.instruction}</div>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Episode</span>
            <span className="font-mono text-xl font-medium">
              {ep.episode}
              <span className="text-muted-foreground"> / {task.targetEpisodes}</span>
            </span>
          </div>
          <div className="grid w-40 gap-2">
            <span className="flex justify-between text-xs text-muted-foreground">
              <span>Duration</span>
              <span className="font-mono">
                {fmt(ep.elapsedMs)} / {fmt(task.durationS * 1000)}
              </span>
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-foreground transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span
            className={cn(
              "flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold tracking-wider",
              PHASE[phase].className,
            )}
            aria-live="polite"
          >
            <span className={cn("size-2 rounded-full bg-current", recording && "animate-pulse")} />
            {PHASE[phase].label}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Subtask</span>
            {task.subtasks.map((s, i) => {
              const current = recording && i === ep.subtask
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!recording}
                  onClick={() => setSubtask(i)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
                    current && "border-primary bg-primary text-primary-foreground",
                    !current && recording && "hover:bg-muted/50",
                    !current && recording && i < ep.subtask && "text-muted-foreground",
                    !recording && "text-muted-foreground",
                  )}
                >
                  <span className="font-mono text-[11px] opacity-70">{s.key}</span>
                  {s.name}
                </button>
              )
            })}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            {streams.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 font-mono text-[11px]">
                <StatusDot tone={rateTone(s)} className="text-[11px]">
                  {s.key}
                </StatusDot>
                <span className="text-muted-foreground">
                  {s.measuredHz?.toFixed(s.measuredHz % 1 ? 1 : 0) ?? "—"}
                  {s.unit}
                </span>
              </span>
            ))}
          </div>
        </div>
      </Panel>
      )}

      {/* Live — 좌 7 : 우 3. 좌측은 카메라 2대를 크게, 아래에 Action / Observation 그래프 */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {/* 카메라가 남은 높이를 채우고, 그래프는 고정 높이 */}
          <div className="grid min-h-48 flex-1 gap-3 md:grid-cols-2">
            {cameras.map((c) => (
              <VideoTile
                className="aspect-auto h-full min-h-48"
                recording={recording}
                timecode={recording ? timecode(ep.elapsedMs, task.videoFps) : undefined}
                key={c.id}
                label={c.name.replace(/ camera$/, "")}
                resolution={c.stats.find((s) => s.label === "Resolution")?.value ?? ""}
                measuredFps={c.streams[0].measuredHz}
                targetFps={c.streams[0].targetHz}
              />
            ))}
          </div>

          {/* Rerun time series 처럼 joint 별 플롯. 바깥 패널 없이 플롯 칸에만 테두리 */}
          <JointPlots
            joints={rig.joints}
            hz={task.actionHz}
            actionSource={rig.master}
            stateSource={rig.slave}
            className="h-64 shrink-0"
          />
        </div>

        {/* 우측: 진행도 · Task 정보 · 녹화 상태 · 조작 */}
        <Panel className="gap-5 overflow-y-auto">
          <div className="flex items-center gap-4">
            <ProgressRing pct={progressPct} status={task.status} label="Task progress" className="size-16" />
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xl font-semibold tabular-nums">
                {collected}
                <span className="text-sm font-normal text-muted-foreground"> / {task.targetEpisodes}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.max(0, task.targetEpisodes - collected)} remaining
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">Task</span>
              <TaskPicker task={task} onSelect={setTaskId} disabled={phase !== "idle"} />
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Label</span>
              <p className="text-[13px] leading-snug">{task.instruction}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <span
              className={cn(
                "flex h-10 items-center rounded-md px-3 text-[13px] font-semibold tracking-wider",
                PHASE[phase].className,
              )}
              aria-live="polite"
            >
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full bg-current", recording && "animate-pulse")} />
                {PHASE[phase].label}
              </span>
            </span>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-foreground transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between gap-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              <span className="truncate">
                Episode {ep.episode}
                {ep.lastOutcome ? ` · ${ep.lastOutcome}` : ""}
              </span>
              <span>
                {fmt(ep.elapsedMs)} / {fmt(task.durationS * 1000)}
              </span>
            </div>
          </div>

          <div className="mt-auto grid gap-2">
            <Button
              onClick={toggle}
              className={cn("h-11 w-full", recording && "bg-destructive text-white hover:bg-destructive/90")}
            >
              {recording ? <LuSquare /> : <LuCircle />}
              {recording ? "Stop" : "Start"}
              <Kbd className="ml-auto bg-transparent text-current opacity-60">Space</Kbd>
            </Button>
            {/* 좁은 열이라 한 줄에 하나씩 */}
            <div className="grid gap-1.5">
              <Button variant="outline" className="h-9 justify-between px-3" disabled={phase === "idle"} onClick={() => save("success")}>
                Save as success <Kbd>→</Kbd>
              </Button>
              <Button variant="outline" className="h-9 justify-between px-3" disabled={phase === "idle"} onClick={() => save("fail")}>
                Save as fail <Kbd>F</Kbd>
              </Button>
              <Button variant="outline" className="h-9 justify-between px-3" disabled={phase === "idle"} onClick={start}>
                Re-record <Kbd>←</Kbd>
              </Button>
              <Button
                variant="outline"
                className="h-9 justify-between px-3 text-bad"
                disabled={phase === "idle"}
                onClick={discard}
              >
                Discard <Kbd>Esc</Kbd>
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </Page>
  )
}
