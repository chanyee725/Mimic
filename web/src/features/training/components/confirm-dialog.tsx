import { useEffect } from "react"
import { LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DetailList } from "@/components/common/detail-list"
import { useCommandPreview, useStartJob } from "@/api/training"
import type { JobCreate, TrainingConfig } from "@/domain/training"
import { formatRate, formatUsd } from "@/lib/format"

import { runpodSummary, type TrainingPlan } from "../lib"
import { ErrorNote } from "@/components/common/query-state"

// Values can be long or multi-line, so allow wrapping and use a wider gap
const ROWS = "[&_dd]:overflow-visible [&_dd]:whitespace-normal [&>div]:gap-6"

/** Shows the chosen settings and the server's command line once more, then starts (or queues) the job */
export function ConfirmTrainingDialog({
  open,
  onOpenChange,
  config,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: TrainingConfig
  plan: TrainingPlan
}) {
  const preview = useCommandPreview()
  const start = useStartJob()
  const pod = plan.runpod
  const flags = Object.entries(plan.overrides).map(([k, v]) => `${k}=${v}`)
  const body: JobCreate = { dataset: plan.dataset, compute: plan.compute, gpu: plan.gpu, overrides: plan.overrides, runpod: pod }
  const p = preview.data

  // Ask the server for the command line, rate and cost cap each time the dialog opens
  const { mutate: requestPreview, reset: resetPreview } = preview
  const { reset: resetStart } = start
  const bodyKey = JSON.stringify(body)
  useEffect(() => {
    if (!open) return
    resetStart()
    requestPreview(JSON.parse(bodyKey) as JobCreate)
    return resetPreview
  }, [open, bodyKey, requestPreview, resetPreview, resetStart])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan.queuedBehind ? "Queue this training?" : "Start this training?"}</DialogTitle>
          <DialogDescription>
            {plan.queuedBehind
              ? `로컬 GPU 를 ${plan.queuedBehind} 가 쓰고 있어 끝나면 이어서 시작합니다.`
              : pod
                ? "확인을 누르면 RunPod pod 를 빌리고 요금이 나가기 시작합니다. HF Hub 를 거쳐 데이터셋과 checkpoint 를 주고받습니다."
                : "확인을 누르면 이 스테이션의 GPU 에서 바로 시작합니다."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 grid min-h-0 content-start gap-4 overflow-y-auto px-4">
          <section className="grid gap-1">
            <h3 className="text-xs font-medium text-muted-foreground">Training</h3>
            <DetailList
              className={ROWS}
              rows={[
                { k: "Model", v: `${config.policy} (${config.policyBase})` },
                { k: "Dataset", v: plan.dataset },
                {
                  k: "Parameters",
                  v: flags.length ? (
                    <span className="grid justify-items-end">
                      {flags.map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                    </span>
                  ) : (
                    "SmolVLA defaults"
                  ),
                },
              ]}
            />
          </section>

          <section className="grid gap-1">
            <h3 className="text-xs font-medium text-muted-foreground">Compute</h3>
            <DetailList
              className={ROWS}
              rows={[
                { k: "Where", v: plan.compute === "local" ? "Local GPU" : "RunPod" },
                { k: "GPU", v: pod ? `${pod.gpuCount} × ${plan.gpu}` : plan.gpu },
                ...(pod
                  ? [
                      { k: "Pod", v: runpodSummary(pod) },
                      { k: "Disk", v: `${pod.diskGB} GB` },
                      { k: "Network volume", v: config.runpod.volumes.find((v) => v.id === pod.volume)?.label ?? pod.volume },
                      { k: "When finished", v: pod.terminateOnFinish ? "Terminate pod" : "Keep pod running" },
                      {
                        k: "Checkpoints",
                        v: pod.pushToHub ? "Kept in a private HF model repo" : "Downloaded, then the HF repo is deleted",
                      },
                    ]
                  : []),
              ]}
            />
          </section>

          {pod && p?.ratePerHr != null && (
            <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2.5 text-[13px] tabular-nums">
              <span>{formatRate(p.ratePerHr)}</span>
              <span className="text-muted-foreground">
                {p.capHours ? (
                  <>
                    at most <span className="text-foreground">{formatUsd(p.maxCostUsd ?? p.ratePerHr * p.capHours)}</span> (
                    {p.capHours.toFixed(1)} h)
                  </>
                ) : (
                  "no time or budget limit"
                )}
              </span>
            </div>
          )}

          {pod && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              아직 올리지 않은 데이터셋은 HF Hub 에 비공개로 먼저 올립니다. pod 에는 Hugging Face 토큰이 전달되고, checkpoint 는 비공개 모델
              저장소를 거쳐 이 스테이션으로 내려받습니다.
            </p>
          )}

          <section className="grid gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">Command</h3>
            {preview.isError ? (
              <ErrorNote error={preview.error} onRetry={() => requestPreview(body)} />
            ) : (
              <pre className="min-h-16 overflow-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
                {p ? p.command.replace(/ --/g, " \\\n  --") : <span className="text-muted-foreground">Loading…</span>}
              </pre>
            )}
          </section>
        </div>

        <DialogFooter className="items-center">
          {start.isError && <ErrorNote error={start.error} className="mr-auto" />}
          <DialogClose render={<Button variant="outline" />}>Back</DialogClose>
          <Button
            disabled={start.isPending || preview.isError}
            onClick={() => start.mutate(body, { onSuccess: () => onOpenChange(false) })}
          >
            <LuPlay />
            {start.isPending ? "Starting…" : plan.queuedBehind ? "Queue training" : "Start training"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
