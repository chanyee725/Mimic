import { useState } from "react"
import { useSearchParams } from "react-router-dom"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Page, Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { ModelPickerDialog } from "@/components/pickers/model-picker-dialog"
import { CameraGrid } from "@/components/robot/camera-grid"
import { JointPlots } from "@/components/robot/joint-plots"
import { usePorts, useRigDevices } from "@/api/devices"
import { getEvalSamples } from "@/api/evaluate"
import { useModels } from "@/api/models"
import { useRig } from "@/api/rigs"
import { useTask } from "@/api/tasks"
import { useTrainingConfig } from "@/api/training"
import type { Model } from "@/domain/model"
import { useLiveSamples } from "@/hooks/use-live-samples"
import { formatClock } from "@/lib/format"

import { ModelField } from "./components/model-field"
import { ErrorNote, LoadingNote, QueryNote } from "@/components/common/query-state"
import { RunControls } from "./components/run-controls"
import { TrialsList } from "./components/trials-list"
import { useEvalRun } from "./hooks/use-eval-run"

// Runs a checkpoint saved in Models on the real robot.
// The policy takes cameras, joint state and an instruction, outputs actions, and each run is judged Success / Fail.

const DESCRIPTION = "학습한 checkpoint 를 실제 로봇에 올려 지시문을 주고 바로 돌려 봅니다."

export function EvaluatePage() {
  // Preselect via ?model= when coming from the Evaluate button in Models
  const [params] = useSearchParams()
  const models = useModels()
  const [modelId, setModelId] = useState(() => params.get("model") ?? "")
  const list = models.data ?? []
  const model = list.find((m) => m.id === modelId) ?? list[0]

  if (!model)
    return (
      <Page fit title="Evaluate" description={DESCRIPTION}>
        <Panel className="flex-1">
          {models.isPending ? (
            <LoadingNote />
          ) : models.isError ? (
            <ErrorNote error={models.error} onRetry={() => models.refetch()} />
          ) : (
            <EmptyState className="py-10">평가할 모델이 없습니다. Training 의 checkpoint 를 Models 에 먼저 저장하세요.</EmptyState>
          )}
        </Panel>
      </Page>
    )
  return <EvaluateView model={model} onModelChange={setModelId} />
}

function EvaluateView({ model, onModelChange }: { model: Model; onModelChange: (id: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const task = useTask(model.taskId).data
  const rig = useRig(task?.rigId).data
  const devices = useRigDevices(rig?.id)
  const cameras = (devices.data ?? []).filter((d) => d.type === "camera")
  const ports = usePorts()
  const livePorts = new Set((ports.data ?? []).filter((p) => p.kind === "video").flatMap((p) => [p.path, p.device]))
  const policy = useTrainingConfig().data?.policy ?? "SmolVLA"
  // Instruction and time limit start from the model's task and reset when the model changes
  const [edited, setEdited] = useState<{ modelId: string; instruction?: string; limitS?: number }>({ modelId: model.id })
  const own = edited.modelId === model.id ? edited : { modelId: model.id }
  const instruction = own.instruction ?? task?.instruction ?? ""
  const limitInput = own.limitS ?? task?.durationS ?? 30
  const edit = (patch: { instruction?: string; limitS?: number }) => setEdited({ ...own, ...patch })
  // Recording trials is not available yet (the backend refuses record: true)
  const run = useEvalRun({ modelId: model.id, instruction, limitS: limitInput, record: false })
  const samples = useLiveSamples(run.run?.id, run.phase === "running" || run.phase === "judging", getEvalSamples)
  const idle = run.phase === "idle"
  const running = run.phase === "running"

  return (
    <Page fit title="Evaluate" description={DESCRIPTION}>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {/* Same camera tiles as Capture: live previews of the model's rig cameras */}
          <CameraGrid
            cameras={cameras}
            livePorts={livePorts}
            empty={
              devices.isPending || devices.isError ? (
                <QueryNote query={devices} />
              ) : (
                <span className="text-xs text-muted-foreground">모델의 Task 에 연결된 Rig 카메라가 없습니다.</span>
              )
            }
            timecode={running ? formatClock(run.elapsed / 1000) : undefined}
          />
          {/* Same plots as Capture. Action is the policy output, Observation is the follower joints */}
          <JointPlots
            joints={rig?.joints ?? []}
            hz={task?.actionHz ?? 60}
            actionSource={`${policy} ${model.jobId}`}
            stateSource={rig?.slave}
            data={samples}
            hint="로봇이 연결되어 실행되면 관절값이 표시됩니다."
            // Takes the height the cameras leave, as on Capture
            className="min-h-64 flex-1"
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
              onChange={(e) => edit({ instruction: e.target.value })}
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
                value={idle ? limitInput : run.limitS}
                disabled={!idle}
                onChange={(e) => edit({ limitS: Number(e.target.value) || 0 })}
              />
              <span className="text-xs text-muted-foreground">s</span>
            </span>
            <Label htmlFor="e-rec" className="grid gap-0.5 font-normal">
              Record trials as MCAP
              <span className="text-xs text-muted-foreground">아직 준비 중입니다.</span>
            </Label>
            <Switch id="e-rec" checked={false} disabled />
          </div>

          <RunControls
            phase={run.phase}
            elapsed={run.elapsed}
            limitS={run.limitS}
            canStart={run.canStart}
            pending={run.pending}
            error={run.runError}
            onStart={run.start}
            onStop={run.stop}
            onJudge={run.judge}
          />
          <ErrorNote error={run.error} />
          {run.runs.isPending ? (
            <LoadingNote className="py-5" />
          ) : run.runs.isError ? (
            <ErrorNote error={run.runs.error} onRetry={() => run.runs.refetch()} />
          ) : (
            <TrialsList trials={run.trials} />
          )}
        </Panel>
      </div>
      <ModelPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} value={model.id} onSelect={onModelChange} />
    </Page>
  )
}
