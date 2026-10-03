import { useState } from "react"
import { LuChevronRight, LuCloud, LuPlay, LuServer, LuSlidersHorizontal } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Panel } from "@/components/layout/page-layout"
import { Segmented } from "@/components/common/segmented"
import { StatusDot } from "@/components/common/status-dot"
import { useTrainingConfig } from "@/api/training"
import { allParams, runpodRate, type Compute, type RunPodOptions, type TrainingConfig } from "@/domain/training"
import { formatRate, formatUsd } from "@/lib/format"

import { changedOverrides, overrideFlags, runpodCapHours, runpodSummary, type Overrides, type TrainingPlan } from "../lib"
import { ConfirmTrainingDialog } from "./confirm-dialog"
import { GpuPickerDialog } from "./gpu-picker-dialog"
import { ParamsDialog } from "./params-dialog"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { RunPodDialog } from "./runpod-dialog"

/** Start training form. Pick dataset, compute and parameters, then confirm in a dialog */
export function StartTraining() {
  const config = useTrainingConfig()
  return (
    <Panel title="Start training" className="min-h-0">
      {config.isPending ? (
        <LoadingNote />
      ) : config.isError ? (
        <ErrorNote error={config.error} onRetry={() => config.refetch()} />
      ) : (
        <StartForm config={config.data} />
      )}
    </Panel>
  )
}

function StartForm({ config }: { config: TrainingConfig }) {
  const { policy, policyBase, localGpus, runpod, trainableDatasets: trainable } = config
  const params = allParams(config)
  const [compute, setCompute] = useState<Compute>("local")
  const [pickedDataset, setDataset] = useState(trainable[0] ?? "")
  // A dataset that stopped being trainable falls back to the first one
  const dataset = trainable.includes(pickedDataset) ? pickedDataset : (trainable[0] ?? "")
  const [cloudGpu, setCloudGpu] = useState("A100 SXM")
  const [gpuOpen, setGpuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [podOpts, setPodOpts] = useState<RunPodOptions>(runpod.defaults)
  const [podOpen, setPodOpen] = useState(false)
  const cloud = runpod.gpus.find((g) => g.name === cloudGpu) ?? runpod.gpus[0]
  const podRate = cloud ? runpodRate(cloud, podOpts, runpod.priceFactor) : 0
  const podCap = runpodCapHours(podOpts, podRate)
  const localGpu = localGpus[0]
  const localBusy = localGpu?.busyBy ?? undefined
  const [paramsOpen, setParamsOpen] = useState(false)
  const [overrides, setOverrides] = useState<Overrides>({})
  const changed = overrideFlags(overrides, params)
  const plan: TrainingPlan = {
    dataset,
    compute,
    gpu: compute === "local" ? (localGpu?.name ?? "") : (cloud?.name ?? ""),
    queuedBehind: compute === "local" ? localBusy : undefined,
    runpod: compute === "runpod" ? podOpts : undefined,
    overrides: changedOverrides(overrides, params),
  }
  const canStart = !!dataset && !!plan.gpu

  return (
    <>
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Model</span>
          <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2 text-[13px]">
            <span className="font-medium">{policy}</span>
            <span className="truncate text-xs text-muted-foreground">{policyBase}</span>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="t-dataset" className="text-xs font-normal text-muted-foreground">
            Dataset
          </Label>
          <Select value={dataset} onValueChange={(v) => v && setDataset(v as string)} disabled={trainable.length === 0}>
            <SelectTrigger id="t-dataset" className="h-9 w-full text-[13px]">
              <SelectValue placeholder="No dataset" />
            </SelectTrigger>
            <SelectContent>
              {trainable.map((d) => (
                <SelectItem key={d} value={d} className="text-[13px]">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {trainable.length === 0 && (
            <span className="text-xs text-muted-foreground">
              학습할 수 있는 LeRobot 데이터셋이 없습니다. Datasets 에서 먼저 변환하세요.
            </span>
          )}
        </div>

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Compute</span>
          <Segmented
            label="Compute"
            role="radiogroup"
            fill
            size="md"
            value={compute}
            onChange={setCompute}
            options={[
              { value: "local", label: "Local GPU", icon: LuServer },
              { value: "runpod", label: "RunPod", icon: LuCloud },
            ]}
          />

          {compute === "local" ? (
            <ul className="grid gap-1.5">
              {localGpus.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-[13px]">
                  <span className="grid gap-0.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.id}, {g.vram}
                    </span>
                  </span>
                  {g.busyBy ? (
                    <StatusDot tone="info" className="text-xs text-muted-foreground">
                      In use by {g.busyBy}
                    </StatusDot>
                  ) : (
                    <StatusDot tone="ok" className="text-xs text-muted-foreground">
                      Free
                    </StatusDot>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            cloud && (
              <button
                type="button"
                onClick={() => setGpuOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
              >
                <span className="grid gap-0.5">
                  <span className="font-medium">{cloud.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {cloud.vramGB} GB, {formatRate(cloud.pricePerHr)}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {runpod.gpus.length} GPUs
                  <LuChevronRight className="size-4" aria-hidden />
                </span>
              </button>
            )
          )}
        </div>

        {compute === "runpod" && (
          <div className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">RunPod options</span>
            <button
              type="button"
              onClick={() => setPodOpen(true)}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="font-medium tabular-nums">
                  {formatRate(podRate)}
                  {podCap > 0 && <span className="font-normal text-muted-foreground">, up to {formatUsd(podRate * podCap)}</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">{runpodSummary(podOpts)}</span>
              </span>
              <LuSlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </div>
        )}

        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Parameters</span>
          <button
            type="button"
            onClick={() => setParamsOpen(true)}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60"
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium">{changed.length ? `${changed.length} changed` : "SmolVLA defaults"}</span>
              <span className="truncate text-xs text-muted-foreground">
                {changed.length
                  ? changed.map((f) => f.replace(/^--(policy\.)?/, "")).join(", ")
                  : "Steps, batch size, learning rate and more"}
              </span>
            </span>
            <LuSlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </div>

      {compute === "local" && localBusy && (
        <p className="text-xs text-muted-foreground">로컬 GPU 가 사용 중이라 {localBusy} 가 끝나면 시작합니다.</p>
      )}
      <Button size="lg" className="w-full" disabled={!canStart} onClick={() => setConfirmOpen(true)}>
        <LuPlay />
        {compute === "local" && localBusy ? "Queue training" : "Start training"}
      </Button>
      <GpuPickerDialog
        open={gpuOpen}
        onOpenChange={setGpuOpen}
        gpus={runpod.gpus}
        value={cloud?.name ?? ""}
        onSelect={(name) => {
          setCloudGpu(name)
          // Fall back to Secure cloud if the GPU is not on Community cloud
          if (!runpod.gpus.find((g) => g.name === name)?.community) setPodOpts((o) => ({ ...o, cloud: "secure" }))
        }}
      />
      <ConfirmTrainingDialog open={confirmOpen} onOpenChange={setConfirmOpen} config={config} plan={plan} />
      {cloud && (
        <RunPodDialog
          communityOk={cloud.community}
          open={podOpen}
          onOpenChange={setPodOpen}
          gpu={cloud}
          runpod={runpod}
          options={podOpts}
          onSave={setPodOpts}
        />
      )}
      <ParamsDialog
        open={paramsOpen}
        onOpenChange={setParamsOpen}
        config={config}
        dataset={dataset}
        overrides={overrides}
        onSave={setOverrides}
      />
    </>
  )
}
