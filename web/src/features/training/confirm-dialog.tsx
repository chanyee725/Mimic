import { LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { POLICY, POLICY_BASE, RUNPOD_VOLUMES, type RunPodOptions } from "@/dummy/training"

import { runpodSummary } from "./jobs"

export type TrainingPlan = {
  dataset: string
  compute: "local" | "runpod"
  gpu: string
  /** 로컬 GPU 가 사용 중이면 그 Job id (대기열로 들어간다) */
  queuedBehind?: string
  runpod?: { options: RunPodOptions; rate: number; capHours: number }
  flags: string[]
}

function Rows({ rows }: { rows: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className="divide-y">
      {rows.map((r) => (
        <div key={r.k} className="flex justify-between gap-6 py-2 text-[13px]">
          <dt className="shrink-0 text-muted-foreground">{r.k}</dt>
          <dd className="min-w-0 text-right tabular-nums">{r.v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 학습 시작 전 고른 값을 한 번 더 보여준다 */
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
  const command = [
    "lerobot-train",
    `--policy.path=${POLICY_BASE}`,
    `--dataset.repo_id=${plan.dataset}`,
    ...(plan.compute === "local" ? ["--policy.device=cuda"] : []),
    ...plan.flags,
  ].join(" \\\n  ")

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
            <Rows
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
            <Rows
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
              <span>${pod.rate.toFixed(2)}/h</span>
              <span className="text-muted-foreground">
                {pod.capHours ? (
                  <>
                    at most <span className="text-foreground">${(pod.rate * pod.capHours).toFixed(2)}</span> ({pod.capHours.toFixed(1)} h)
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
