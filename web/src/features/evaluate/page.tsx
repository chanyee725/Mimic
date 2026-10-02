import { useState } from "react"
import { useSearchParams } from "react-router-dom"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ModelPickerDialog } from "@/components/app/model-picker-dialog"
import { Page, Panel } from "@/components/app/page"
import { JointPlots } from "@/components/robot/joint-plots"
import { VideoTile } from "@/components/robot/video-tile"
import { MODELS, getModel } from "@/dummy/models"
import { getRig } from "@/dummy/rigs"
import { getTask } from "@/dummy/tasks"
import { POLICY } from "@/dummy/training"
import { formatClock } from "@/lib/format"

import { ModelField } from "./components/model-field"
import { RunControls } from "./components/run-controls"
import { TrialsList } from "./components/trials-list"
import { useEvalRun } from "./hooks/use-eval-run"

// Runs a checkpoint saved in Models on the real robot.
// The policy takes cameras, joint state and an instruction, outputs actions, and each run is judged Success / Fail.

export function EvaluatePage() {
  // Preselect via ?model= when coming from the Evaluate button in Models
  const [params] = useSearchParams()
  const [modelId, setModelId] = useState(() => getModel(params.get("model") ?? "")?.id ?? MODELS[0].id)
  const model = getModel(modelId) ?? MODELS[0]
  const [pickerOpen, setPickerOpen] = useState(false)
  const task = getTask(model.taskId)
  const rig = getRig(task?.rigId ?? "so101-kit")
  const [instruction, setInstruction] = useState(task?.instruction ?? "")
  const [record, setRecord] = useState(false)
  const run = useEvalRun(instruction, task?.durationS ?? 30)
  const idle = run.phase === "idle"
  const running = run.phase === "running"

  const changeModel = (id: string) => {
    setModelId(id)
    setInstruction(getTask(getModel(id)?.taskId ?? "")?.instruction ?? "")
    run.clearTrials()
  }

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
                timecode={running ? formatClock(run.elapsed / 1000) : undefined}
              />
            ))}
          </div>
          {/* Same plots as Capture. Action is the policy output, Observation is the follower joints */}
          <JointPlots
            joints={rig.joints}
            hz={task?.actionHz ?? 60}
            actionSource={`${POLICY} ${model.jobId}`}
            stateSource={rig.slave}
            className="h-64 shrink-0"
          />
        </div>

        <Panel className="gap-5 overflow-y-auto">
          <ModelField model={model} disabled={!idle} onOpen={() => setPickerOpen(true)} />

          <div className="grid gap-1.5">
            <Label htmlFor="e-inst" className="text-xs font-normal text-muted-foreground">
              Instruction
            </Label>
            <Textarea
              id="e-inst"
              rows={2}
              className="resize-none text-[13px]"
              value={instruction}
              disabled={!idle}
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
                value={run.limitS}
                disabled={!idle}
                onChange={(e) => run.setLimitS(Number(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </span>
            <Label htmlFor="e-rec" className="font-normal">
              Record trials as MCAP
            </Label>
            <Switch id="e-rec" checked={record} onCheckedChange={setRecord} disabled={!idle} />
          </div>

          <RunControls
            phase={run.phase}
            elapsed={run.elapsed}
            limitS={run.limitS}
            canStart={run.canStart}
            onStart={run.start}
            onStop={run.stop}
            onJudge={run.judge}
          />
          <TrialsList trials={run.trials} />
        </Panel>
      </div>
      <ModelPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} value={model.id} onSelect={changeModel} />
    </Page>
  )
}
