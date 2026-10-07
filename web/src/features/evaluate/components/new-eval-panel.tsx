import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { LuChevronRight, LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { LinkButton } from "@/components/common/link-button"
import { Segmented } from "@/components/common/segmented"
import { StatusDot } from "@/components/common/status-dot"
import { ModelPickerDialog } from "@/components/pickers/model-picker-dialog"
import { useModels } from "@/api/models"
import { useSimConfig, useSimEnvs, useStartSimJob } from "@/api/simulation"
import { useTasks } from "@/api/tasks"
import type { Model } from "@/domain/model"
import type { Randomization, SimEnv, SimGpu } from "@/domain/simulation"
import type { Task } from "@/domain/task"

import { NEW_EVAL_DEFAULTS, RANDOMIZATION, orderEnvs, pickEnvId, taskEnvId, usableEnvs } from "../lib"
import { EnvPicker } from "./env-picker"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"

type FormData = { models: Model[]; envs: SimEnv[]; tasks: Task[] }

/**
 * New evaluation form. Pick a saved model, load it into one of the registered environments,
 * set the rollout count, then start (or queue) on the local GPU.
 */
export function NewEvalPanel({ initialEnvId, initialModelId }: { initialEnvId?: string; initialModelId?: string }) {
  const queries = [useModels(), useSimEnvs(), useTasks()] as const
  const [models, envs, tasks] = queries
  const failed = queries.find((q) => q.isError)

  return (
    <Panel title="New evaluation" className="min-h-0">
      {failed ? (
        <ErrorNote error={failed.error} onRetry={() => queries.forEach((q) => q.isError && q.refetch())} />
      ) : !models.data || !envs.data || !tasks.data ? (
        <LoadingNote />
      ) : (
        <NewEvalForm
          data={{ models: models.data, envs: envs.data, tasks: tasks.data }}
          initialEnvId={initialEnvId}
          initialModelId={initialModelId}
        />
      )}
    </Panel>
  )
}

function NewEvalForm({ data, initialEnvId, initialModelId }: { data: FormData; initialEnvId?: string; initialModelId?: string }) {
  const navigate = useNavigate()
  const start = useStartSimJob()
  const gpu = useSimConfig().data?.gpu
  const [modelId, setModelId] = useState(() => (data.models.find((m) => m.id === initialModelId) ?? data.models[0])?.id ?? "")
  const model = data.models.find((m) => m.id === modelId)
  // ?env= wins, else the environment of the model's task
  const fits = usableEnvs(data.envs, model, data.tasks)
  const [envId, setEnvId] = useState(() => pickEnvId(fits, taskEnvId(model, data.tasks), initialEnvId))
  const envs = orderEnvs(fits, taskEnvId(model, data.tasks))
  const selected = fits.find((e) => e.id === envId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [episodes, setEpisodes] = useState(NEW_EVAL_DEFAULTS.episodes)
  const [seedStart, setSeedStart] = useState(NEW_EVAL_DEFAULTS.seedStart)
  const [maxSeconds, setMaxSeconds] = useState(NEW_EVAL_DEFAULTS.maxSeconds)
  const [randomization, setRandomization] = useState<Randomization>(NEW_EVAL_DEFAULTS.randomization)
  const busyBy = gpu?.busyBy
  const hint = RANDOMIZATION.find((r) => r.value === randomization)?.hint

  const submit = () => {
    if (!model || !selected) return
    start.mutate(
      { modelId: model.id, envId: selected.id, episodes, seedStart, maxSeconds, randomization },
      { onSuccess: (job) => navigate(`/evaluate/sim/${job.id}`) },
    )
  }

  return (
    <>
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
          {data.models.length === 0 && (
            <p className="text-xs text-muted-foreground">
              저장된 모델이 없습니다. Training 의 checkpoint 를 Models 에 저장하면 평가할 수 있습니다.
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <div className="flex h-5 items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Environment</span>
            <LinkButton to="/environments" variant="ghost" size="xs" className="text-muted-foreground">
              Manage
            </LinkButton>
          </div>
          {envs.length === 0 ? (
            <EmptyState className="px-4">
              {data.envs.length === 0 ? "환경 폴더에 환경 스크립트가 없습니다." : "이 모델의 Rig 에서 쓸 수 있는 환경이 없습니다."}
            </EmptyState>
          ) : (
            <EnvPicker envs={envs} value={selected?.id} onChange={setEnvId} />
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

        <GpuRow gpu={gpu} />
      </div>

      {busyBy && <p className="text-xs text-muted-foreground">GPU 가 사용 중이라 {busyBy} 가 끝나면 시작합니다.</p>}
      <ErrorNote error={start.error} />
      <Button size="lg" className="w-full" disabled={!model || !selected || start.isPending} onClick={submit}>
        <LuPlay />
        {start.isPending ? "Starting…" : busyBy ? "Queue evaluation" : "Start evaluation"}
      </Button>
      <ModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={modelId}
        onSelect={(id) => {
          setModelId(id)
          start.reset()
          // The new model's task environment, if it has one; otherwise keep the current one
          const next = data.models.find((m) => m.id === id)
          setEnvId(pickEnvId(usableEnvs(data.envs, next, data.tasks), taskEnvId(next, data.tasks), envId))
        }}
      />
    </>
  )
}

function GpuRow({ gpu }: { gpu?: SimGpu }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">GPU</span>
      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-[13px]">
        {gpu ? (
          <>
            <span className="grid gap-0.5">
              <span className="font-medium">
                {gpu.name} ({gpu.id})
              </span>
              <span className="text-xs text-muted-foreground">{gpu.vram}, Isaac Sim</span>
            </span>
            {gpu.busyBy ? (
              <StatusDot tone="info" className="text-xs text-muted-foreground">
                In use by {gpu.busyBy}
              </StatusDot>
            ) : (
              <StatusDot tone="ok" className="text-xs text-muted-foreground">
                Free
              </StatusDot>
            )}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Loading…</span>
        )}
      </div>
    </div>
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
