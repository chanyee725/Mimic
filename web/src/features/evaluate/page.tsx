import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { LuCheck, LuChevronRight, LuPlay, LuSquare, LuX } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatusDot } from "@/components/app/status-dot"
import { JointPlots } from "@/components/robot/joint-plots"
import { VideoTile } from "@/components/robot/video-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getRig } from "@/dummy/rigs"
import { getTask } from "@/dummy/tasks"
import { MODELS, getModel } from "@/dummy/models"
import { LOCAL_GPUS, POLICY } from "@/dummy/training"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ModelPickerDialog } from "@/features/models/model-picker-dialog"

// Models 에 저장한 checkpoint 를 실제 로봇에 올려 바로 돌려 보는 페이지.
// 정책이 카메라 · 관절 상태 · 지시문을 받아 action 을 내고, 결과를 Success / Fail 로 기록한다.

type Phase = "idle" | "running" | "judging"
type Trial = { n: number; instruction: string; seconds: number; result: "success" | "fail" }

export function EvaluatePage() {
  // Models 의 Evaluate 버튼에서 오면 ?model= 로 미리 고른다
  const [params] = useSearchParams()
  const [modelId, setModelId] = useState(() => getModel(params.get("model") ?? "")?.id ?? MODELS[0].id)
  const model = getModel(modelId) ?? MODELS[0]
  const [pickerOpen, setPickerOpen] = useState(false)
  const task = getTask(model.taskId)
  const rig = getRig(task?.rigId ?? "so101-kit")
  const [instruction, setInstruction] = useState(task?.instruction ?? "")
  const [limitS, setLimitS] = useState(task?.durationS ?? 30)
  const [record, setRecord] = useState(false)

  const [phase, setPhase] = useState<Phase>("idle")
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [trials, setTrials] = useState<Trial[]>([])

  const changeModel = (id: string) => {
    setModelId(id)
    setInstruction(getTask(getModel(id)?.taskId ?? "")?.instruction ?? "")
    setTrials([])
  }

  const start = () => {
    setStartedAt(performance.now())
    setElapsed(0)
    setPhase("running")
  }
  const stop = () => setPhase("judging")
  const judge = (result: Trial["result"] | null) => {
    if (result) setTrials((t) => [...t, { n: t.length + 1, instruction, seconds: elapsed / 1000, result }])
    setPhase("idle")
  }

  // 경과 시간, 제한 시간이 되면 멈춘다
  useEffect(() => {
    if (phase !== "running") return
    const id = setInterval(() => {
      const ms = performance.now() - startedAt
      setElapsed(ms)
      if (ms >= limitS * 1000) setPhase("judging")
    }, 100)
    return () => clearInterval(id)
  }, [phase, startedAt, limitS])

  // Space 시작 · Esc 멈춤 · S / F 판정
  useHotkeys((e) => {
    if (phase === "idle" && e.code === "Space" && instruction.trim()) start()
    else if (phase === "running" && (e.code === "Escape" || e.code === "Space")) stop()
    else if (phase === "judging" && e.key.toLowerCase() === "s") judge("success")
    else if (phase === "judging" && e.key.toLowerCase() === "f") judge("fail")
    else return false
    return true
  })

  const wins = trials.filter((t) => t.result === "success").length
  const running = phase === "running"

  return (
    <Page fit title="Evaluate" description="학습한 checkpoint 를 실제 로봇에 올려 지시문을 주고 바로 돌려 봅니다.">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          <div className="grid min-h-48 flex-1 gap-3 md:grid-cols-2">
            {rig.cameras.map((c) => (
              <VideoTile
                key={c.id}
                className="aspect-auto h-full min-h-48"
                label={c.name.replace(/ camera$/, "")}
                resolution={c.resolution}
                measuredFps={c.fps}
                targetFps={c.fps}
                recording={running && record}
                timecode={running ? formatClock(elapsed / 1000) : undefined}
              />
            ))}
          </div>
          {/* Capture 와 같은 그래프. Action 은 정책 출력, Observation 은 follower 관절 */}
          <JointPlots
            joints={rig.joints}
            hz={task?.actionHz ?? 60}
            actionSource={`${POLICY} ${model.jobId}`}
            stateSource={rig.slave}
            className="h-64 shrink-0"
          />
        </div>

        <Panel className="gap-5 overflow-y-auto">
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Model</span>
            <button
              type="button"
              disabled={phase !== "idle"}
              onClick={() => setPickerOpen(true)}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none disabled:opacity-60"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{model.name}</span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {model.jobId}, step {model.step.toLocaleString()}, loss {model.loss.toFixed(3)}
                </span>
              </span>
              <LuChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            <span className="text-xs text-muted-foreground">
              {model.dataset}, inference on {LOCAL_GPUS[0].name}
            </span>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="e-inst" className="text-xs font-normal text-muted-foreground">
              Instruction
            </Label>
            <Textarea
              id="e-inst"
              rows={2}
              className="resize-none text-[13px]"
              value={instruction}
              disabled={phase !== "idle"}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">학습한 label 과 다른 문장도 넣어 볼 수 있습니다.</span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
            <Label htmlFor="e-limit" className="font-normal">
              Stop after
            </Label>
            <span className="flex items-center gap-2">
              <Input
                id="e-limit"
                className="h-8 w-16 text-right text-[13px] tabular-nums"
                inputMode="numeric"
                value={limitS}
                disabled={phase !== "idle"}
                onChange={(e) => setLimitS(Number(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </span>
            <Label htmlFor="e-rec" className="font-normal">
              Record trials as MCAP
            </Label>
            <Switch id="e-rec" checked={record} onCheckedChange={setRecord} disabled={phase !== "idle"} />
          </div>

          {/* 실행 상태 · 조작 */}
          <div className="grid gap-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <StatusDot
                tone={running ? "info" : phase === "judging" ? "warn" : "muted"}
                className={cn("text-[13px]", running && "[&>span]:animate-pulse")}
              >
                {running ? "Policy running" : phase === "judging" ? "Did it work?" : "Ready"}
              </StatusDot>
              <span className="font-mono text-2xl font-medium tabular-nums">{formatClock(elapsed / 1000)}</span>
            </div>
            {running && (
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, (elapsed / (limitS * 1000)) * 100)}%` }} />
              </div>
            )}

            {phase === "idle" && (
              <Button size="lg" className="w-full" disabled={!instruction.trim()} onClick={start}>
                <LuPlay />
                Run policy
                <Kbd className="ml-auto">Space</Kbd>
              </Button>
            )}
            {running && (
              <Button size="lg" variant="outline" className="w-full text-bad hover:text-bad" onClick={stop}>
                <LuSquare />
                Stop
                <Kbd className="ml-auto">Esc</Kbd>
              </Button>
            )}
            {phase === "judging" && (
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button className="bg-ok text-white hover:bg-ok/90" onClick={() => judge("success")}>
                    <LuCheck />
                    Success
                    <Kbd className="ml-auto">S</Kbd>
                  </Button>
                  <Button variant="outline" className="text-bad hover:text-bad" onClick={() => judge("fail")}>
                    <LuX />
                    Fail
                    <Kbd className="ml-auto">F</Kbd>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => judge(null)}>
                  Discard this run
                </Button>
              </div>
            )}
          </div>

          {/* 이번 세션의 시도 기록 */}
          <section className="grid gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Trials</h3>
              {trials.length > 0 && (
                <span className="text-[13px] tabular-nums">
                  {wins} / {trials.length} success
                  <span className="text-muted-foreground"> ({Math.round((wins / trials.length) * 100)}%)</span>
                </span>
              )}
            </div>
            {trials.length === 0 ? (
              <p className="rounded-md border border-dashed py-5 text-center text-xs text-muted-foreground">
                정책을 돌린 뒤 결과를 표시하면 여기에 쌓입니다.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {[...trials].reverse().map((t) => (
                  <li key={t.n} className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-1.5 text-[13px]">
                    <span className="text-muted-foreground tabular-nums">#{t.n}</span>
                    <span className="truncate text-muted-foreground" title={t.instruction}>
                      {t.instruction}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{t.seconds.toFixed(1)} s</span>
                    <StatusDot tone={t.result === "success" ? "ok" : "bad"} className="w-16 justify-end text-xs">
                      {t.result === "success" ? "Success" : "Fail"}
                    </StatusDot>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Panel>
      </div>
      <ModelPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} value={model.id} onSelect={changeModel} />
    </Page>
  )
}
