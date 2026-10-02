import { useEffect, useState } from "react"
import { LuCircle, LuOctagonX, LuSquare } from "react-icons/lu"

import { Page, Panel, PanelLink } from "@/components/app/page"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { devicesOf, type DeviceStream } from "@/dummy/devices"
import { getRig } from "@/dummy/rigs"
import { TASKS } from "@/dummy/tasks"
import { cn } from "@/lib/utils"
import { AlignmentStrip } from "./components/alignment-strip"
import { EpisodeList } from "./components/episode-list"
import { HandPanel } from "./components/hand-panel"
import { TimeSeries } from "./components/timeseries"
import { VideoTile } from "./components/video-tile"
import { Viewer3D } from "./components/viewer3d"
import { useEpisode, type Phase } from "./use-episode"

const PHASE: Record<Phase, { label: string; className: string }> = {
  idle: { label: "READY", className: "bg-muted text-muted-foreground" },
  recording: { label: "REC", className: "bg-bad-muted text-bad" },
  review: { label: "REVIEW", className: "bg-warn-muted text-warn" },
}

function rateTone(s: DeviceStream): Tone {
  if (s.measuredHz === null || s.targetHz === null) return "muted"
  return s.measuredHz >= s.targetHz * 0.98 ? "ok" : "warn"
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
  const [gloveDemo, setGloveDemo] = useState(false)

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
  const glove = rigDevices.find((d) => d.type === "glove")
  const pedal = rigDevices.find((d) => d.type === "input")
  const gloveOn = gloveDemo || glove?.health === "ok"

  const streams = rigDevices
    .filter((d) => d.type !== "input" && (d.type !== "glove" || gloveOn))
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

  return (
    <Page
      fit
      title="Capture"
      description={`${rig.name} · ${rig.master} → ${rig.slave} · action ${task.actionHz} Hz / video ${task.videoFps} fps`}
      actions={
        <>
          <span className="flex h-8 items-center rounded-md border px-2.5">
            <StatusDot tone={pedal?.health === "ok" ? "ok" : "muted"} className="text-xs font-medium">
              Foot pedal
            </StatusDot>
          </span>
          {/* UI 와 무관하게 동작하는 물리 E-Stop 을 함께 둘 것 */}
          <Button size="lg" className="bg-destructive text-white hover:bg-destructive/90">
            <LuOctagonX />
            E-Stop
          </Button>
        </>
      }
    >
      {/* Session */}
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

      {/* Live — 데스크톱에서는 남은 높이 안에서만 스크롤 */}
      <div className="grid min-h-0 flex-1 gap-4 lg:overflow-y-auto xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {cameras.map((c) => (
              <VideoTile
                key={c.id}
                label={c.name.replace(/ camera$/, "")}
                resolution={c.stats.find((s) => s.label === "Resolution")?.value ?? ""}
                measuredFps={c.streams[0].measuredHz}
                targetFps={c.streams[0].targetHz}
              />
            ))}
          </div>

          <Panel
            title="Action / State"
            action={<span className="text-xs text-muted-foreground">solid = leader action · dashed = follower state</span>}
          >
            <TimeSeries series={rig.joints} hz={task.actionHz} height={120} />
            <AlignmentStrip actionHz={task.actionHz} videoFps={task.videoFps} />
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Viewer3D />
          {/* 녹화 직후 검수: 저장 시 자동 검증 결과를 보고 Accept / Reject */}
          <Panel
            title="Episodes"
            action={
              <span className="text-xs text-muted-foreground tabular-nums">
                {ep.history.filter((e) => e.review === "accepted").length} accepted ·{" "}
                {ep.history.filter((e) => e.review === "pending").length} pending
              </span>
            }
          >
            <EpisodeList episodes={ep.history} videoFps={task.videoFps} onReview={ep.review} />
          </Panel>
          <Panel
            title={`Hand · ${glove?.name ?? "Data Glove"}`}
            action={
              gloveOn ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {glove?.streams.map((s) => `${s.key.replace("hand.", "")} ${s.targetHz}`).join(" · ")} Hz
                </span>
              ) : (
                <PanelLink to="/devices">Devices</PanelLink>
              )
            }
          >
            <HandPanel connected={gloveOn} onDemo={() => setGloveDemo(true)} />
          </Panel>
        </div>
      </div>

      {/* Episode controls — 좁은 화면에서는 하단에 붙어 따라온다 */}
      <div className="sticky bottom-0 shrink-0 bg-background lg:static">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <Button
            onClick={toggle}
            className={cn("h-11 px-4.5", recording && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {recording ? <LuSquare /> : <LuCircle />}
            {recording ? "Stop" : "Start"}
            <Kbd className="ml-1 bg-transparent text-current opacity-60">Space</Kbd>
          </Button>
          <Button variant="outline" className="h-11" disabled={phase === "idle"} onClick={() => save("success")}>
            Save · success <Kbd>→</Kbd>
          </Button>
          <Button variant="outline" className="h-11" disabled={phase === "idle"} onClick={() => save("fail")}>
            Save · fail <Kbd>F</Kbd>
          </Button>
          <Button variant="outline" className="h-11" disabled={phase === "idle"} onClick={start}>
            Re-record <Kbd>←</Kbd>
          </Button>
          <Button variant="outline" className="h-11 text-bad" disabled={phase === "idle"} onClick={discard}>
            Discard <Kbd>Esc</Kbd>
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {ep.lastOutcome ? `Last saved: ${ep.lastOutcome} · ` : ""}
            Reset {task.resetS}s · auto-validate on save
          </span>
        </div>
      </div>
    </Page>
  )
}
