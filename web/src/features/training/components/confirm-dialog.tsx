import { LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DetailList } from "@/components/common/detail-list"
import { POLICY, POLICY_BASE, RUNPOD_VOLUMES } from "@/api/training"
import { formatRate, formatUsd } from "@/lib/format"

import { runpodSummary, trainCommand, type TrainingPlan } from "../lib"

// Values can be long or multi-line, so allow wrapping and use a wider gap
const ROWS = "[&_dd]:overflow-visible [&_dd]:whitespace-normal [&>div]:gap-6"

/** Shows the chosen settings once more before training starts */
export function ConfirmTrainingDialog({
  open,
  onOpenChange,
  plan,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: TrainingPlan
  onConfirm: () => void
}) {
  const pod = plan.runpod
  const command = trainCommand(plan.dataset, [...(plan.compute === "local" ? ["--policy.device=cuda"] : []), ...plan.flags])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan.queuedBehind ? "Queue this training?" : "Start this training?"}</DialogTitle>
          <DialogDescription>
            {plan.queuedBehind
              ? `로컬 GPU 를 ${plan.queuedBehind} 가 쓰고 있어 끝나면 이어서 시작합니다.`
              : pod
                ? "확인을 누르면 RunPod pod 를 빌리고 요금이 나가기 시작합니다."
                : "확인을 누르면 이 스테이션의 GPU 에서 바로 시작합니다."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 grid min-h-0 content-start gap-4 overflow-y-auto px-4">
          <section className="grid gap-1">
            <h3 className="text-xs font-medium text-muted-foreground">Training</h3>
            <DetailList
              className={ROWS}
              rows={[
                { k: "Model", v: `${POLICY} (${POLICY_BASE})` },
                { k: "Dataset", v: plan.dataset },
                {
                  k: "Parameters",
                  v: plan.flags.length ? (
                    <span className="grid justify-items-end">
                      {plan.flags.map((f) => (
                        <span key={f}>{f.replace(/^--/, "")}</span>
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
                { k: "GPU", v: pod ? `${pod.options.gpuCount} × ${plan.gpu}` : plan.gpu },
                ...(pod
                  ? [
                      { k: "Pod", v: runpodSummary(pod.options) },
                      { k: "Disk", v: `${pod.options.diskGB} GB` },
                      { k: "Network volume", v: RUNPOD_VOLUMES.find((v) => v.id === pod.options.volume)?.label ?? pod.options.volume },
                      { k: "When finished", v: pod.options.terminateOnFinish ? "Terminate pod" : "Keep pod running" },
                    ]
                  : []),
              ]}
            />
          </section>

          {pod && (
            <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted px-3 py-2.5 text-[13px] tabular-nums">
              <span>{formatRate(pod.rate)}</span>
              <span className="text-muted-foreground">
                {pod.capHours ? (
                  <>
                    at most <span className="text-foreground">{formatUsd(pod.rate * pod.capHours)}</span> ({pod.capHours.toFixed(1)} h)
                  </>
                ) : (
                  "no time or budget limit"
                )}
              </span>
            </div>
          )}

          <section className="grid gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">Command</h3>
            <pre className="overflow-auto rounded-md bg-muted p-2.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
              {command}
            </pre>
          </section>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Back</DialogClose>
          <Button
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            <LuPlay />
            {plan.queuedBehind ? "Queue training" : "Start training"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
