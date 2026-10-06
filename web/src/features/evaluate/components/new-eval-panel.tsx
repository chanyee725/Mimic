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
import { ApiError } from "@/api/client"
import { useModels } from "@/api/models"
import { useRigs } from "@/api/rigs"
import { useSimConfig, useSimEnvs, useStartSimJob } from "@/api/simulation"
import { useTasks } from "@/api/tasks"
import type { Model } from "@/domain/model"
import type { Rig } from "@/domain/rig"
import type { CompatIssue, Randomization, SimEnv, SimGpu } from "@/domain/simulation"
import type { Task } from "@/domain/task"

import { NEW_EVAL_DEFAULTS, RANDOMIZATION, envOptions, initialSelection, modelSpec, taskEnvId, usableEnvId, type EnvOption } from "../lib"
import { EnvPicker } from "./env-picker"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"

type FormData = { models: Model[]; envs: SimEnv[]; tasks: Task[]; rigs: Rig[] }

/**
 * New evaluation form. Pick a saved model, load it into one of the registered environments,
 * set the rollout count, then start (or queue) on the local GPU.
 */
export function NewEvalPanel({ initialEnvId, initialModelId }: { initialEnvId?: string; initialModelId?: string }) {
  const queries = [useModels(), useSimEnvs(), useTasks(), useRigs()] as const
  const [models, envs, tasks, rigs] = queries
  const failed = queries.find((q) => q.isError)

  return (
    <Panel title="New evaluation" className="min-h-0">
      {failed ? (
        <ErrorNote error={failed.error} onRetry={() => queries.forEach((q) => q.isError && q.refetch())} />
      ) : !models.data || !envs.data || !tasks.data || !rigs.data ? (
        <LoadingNote />
      ) : (
        <NewEvalForm
          data={{ models: models.data, envs: envs.data, tasks: tasks.data, rigs: rigs.data }}
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
  // Compatibility is checked client-side with the same rule as the backend (domain envCompat)
  const optionsFor = (m?: Model): EnvOption[] =>
    envOptions(data.envs, m, m && modelSpec(m, data.tasks, data.rigs), taskEnvId(m, data.tasks))
  const findEnv = (id?: string) => data.envs.find((e) => e.id === id)

  const [initial] = useState(() => initialSelection(data.models, optionsFor, initialEnvId, initialModelId))
  const [modelId, setModelId] = useState(initial.modelId)
  const model = data.models.find((m) => m.id === modelId)
  const options = optionsFor(model)
  const [envId, setEnvId] = useState(initial.envId)
  const selected = options.find((o) => o.env.id === envId && o.usable)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [episodes, setEpisodes] = useState(NEW_EVAL_DEFAULTS.episodes)
  const [seedStart, setSeedStart] = useState(NEW_EVAL_DEFAULTS.seedStart)
  const [maxSeconds, setMaxSeconds] = useState(() => findEnv(initial.envId)?.maxSeconds ?? NEW_EVAL_DEFAULTS.maxSeconds)
  const [randomization, setRandomization] = useState<Randomization>(NEW_EVAL_DEFAULTS.randomization)
  const busyBy = gpu?.busyBy
  const hint = RANDOMIZATION.find((r) => r.value === randomization)?.hint
  // ?env= named an environment the chosen model can't be loaded into
  const requested = initialEnvId && initialEnvId !== envId ? options.find((o) => o.env.id === initialEnvId && !o.usable) : undefined

  // A newly selected environment brings its own default time limit
  const selectEnv = (id?: string) => {
    if (id === envId) return
    setEnvId(id)
    const next = findEnv(id)
    if (next) setMaxSeconds(next.maxSeconds)
  }

  const submit = () => {
    if (!model || !selected) return
    start.mutate(
      { modelId: model.id, envId: selected.env.id, episodes, seedStart, maxSeconds, randomization },
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
          {requested && (
            <p className="text-xs text-muted-foreground">{requested.env.name} 에는 이 모델을 불러올 수 없어 다른 환경을 골랐습니다.</p>
          )}
          {!options.some((o) => o.usable) && (
            <EmptyState className="px-4">이 모델을 불러올 수 있는 환경이 없습니다. 환경 폴더를 추가하세요.</EmptyState>
          )}
          {options.length > 0 && <EnvPicker options={options} value={selected?.env.id} onChange={selectEnv} />}
          {selected?.issues.some((i) => i.level === "warn") && (
            <p className="text-xs text-warn">이 환경은 실제 rig 와 맞춰지지 않아 결과가 실제 로봇과 다를 수 있습니다.</p>
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
      <StartError error={start.error} />
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
          // Keep the environment if the new model still loads into it, else jump to the first usable one
          selectEnv(usableEnvId(optionsFor(data.models.find((m) => m.id === id)), envId))
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

/** Start failure; an incompatible pair (422) also lists the compatibility issues */
function StartError({ error }: { error: Error | null }) {
  if (!error) return null
  const issues = error instanceof ApiError ? ((error.details.issues as CompatIssue[] | undefined) ?? []) : []
  return (
    <div className="grid gap-1">
      <ErrorNote error={error} />
      {issues.map((i) => (
        <p key={i.text} className={i.level === "error" ? "text-xs text-bad" : "text-xs text-warn"}>
          {i.text}
        </p>
      ))}
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
