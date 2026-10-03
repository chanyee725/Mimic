import { useState } from "react"
import { LuChevronRight, LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/layout/page-layout"
import { Segmented } from "@/components/common/segmented"
import { StatusDot } from "@/components/common/status-dot"
import { ModelPickerDialog } from "@/components/pickers/model-picker-dialog"
import { getModel, listModels } from "@/api/models"
import { SIM_GPU } from "@/api/simulation"
import type { Randomization } from "@/domain/simulation"

import { RANDOMIZATION } from "../lib"
import { NEW_EVAL_DEFAULTS, envOptions, simGpuHolder } from "../new-eval"
import { SceneList } from "./scene-list"

/** New evaluation form. Pick a saved model and a scene, set the rollout count, then start (or queue) on the local GPU */
export function NewEvalPanel({ initialEnvId }: { initialEnvId?: string }) {
  void initialEnvId
  return <NewEvalPanelBody />
}

function NewEvalPanelBody() {
  const [modelId, setModelId] = useState(() => listModels()[0]?.id ?? "")
  const model = getModel(modelId)
  const options = envOptions(model)
  const scenes = options.map((o) => o.env)
  const [sceneId, setSceneId] = useState(() => scenes[0]?.id ?? "")
  const scene = scenes.find((s) => s.id === sceneId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [episodes, setEpisodes] = useState(NEW_EVAL_DEFAULTS.episodes)
  const [seedStart, setSeedStart] = useState(NEW_EVAL_DEFAULTS.seedStart)
  const [maxSeconds, setMaxSeconds] = useState(NEW_EVAL_DEFAULTS.maxSeconds)
  const [randomization, setRandomization] = useState<Randomization>(NEW_EVAL_DEFAULTS.randomization)
  const busyBy = simGpuHolder()
  const hint = RANDOMIZATION.find((r) => r.value === randomization)?.hint

  return (
    <Panel title="New evaluation" className="min-h-0">
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Model</span>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium">{model?.name ?? "Choose a model"}</span>
              {model && (
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {model.jobId}, step {model.step.toLocaleString()}
                </span>
              )}
            </span>
            <LuChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Scene</span>
          <SceneList scenes={scenes} value={sceneId} onChange={setSceneId} />
          {scene && !scene.calibrated && (
            <p className="text-xs text-warn">이 장면은 실제 리그와 맞추지 않아 결과가 실제 로봇과 다를 수 있습니다.</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <NumberField id="e-episodes" label="Episodes" value={episodes} min={1} onChange={setEpisodes} />
          <NumberField id="e-seed" label="Seed start" value={seedStart} min={0} onChange={setSeedStart} />
          <NumberField id="e-time" label="Time limit (s)" value={maxSeconds} min={1} onChange={setMaxSeconds} />
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Randomization</span>
          <Segmented
            label="Randomization"
            role="radiogroup"
            fill
            size="md"
            value={randomization}
            onChange={setRandomization}
            options={RANDOMIZATION.map((r) => ({ value: r.value, label: r.label }))}
          />
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">GPU</span>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-[13px]">
            <span className="grid gap-0.5">
              <span className="font-medium">
                {SIM_GPU.name} ({SIM_GPU.id})
              </span>
              <span className="text-xs text-muted-foreground">{SIM_GPU.vram}, Isaac Sim</span>
            </span>
            {busyBy ? (
              <StatusDot tone="info" className="text-xs text-muted-foreground">
                In use by {busyBy}
              </StatusDot>
            ) : (
              <StatusDot tone="ok" className="text-xs text-muted-foreground">
                Free
              </StatusDot>
            )}
          </div>
        </div>
      </div>

      {busyBy && <p className="text-xs text-muted-foreground">GPU 가 사용 중이라 {busyBy} 가 끝나면 시작합니다.</p>}
      <Button size="lg" className="w-full" disabled={!model || !scene}>
        <LuPlay />
        {busyBy ? "Queue evaluation" : "Start evaluation"}
      </Button>
      <ModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={modelId}
        onSelect={(id) => {
          setModelId(id)
          // Jump to the first scene for the new model's task
          setSceneId(envOptions(getModel(id))[0]?.env.id ?? "")
        }}
      />
    </Panel>
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id} className="truncate text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        className="h-8 text-right text-[13px] tabular-nums"
        value={String(value)}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.max(min, Math.round(n)))
        }}
      />
    </div>
  )
}
