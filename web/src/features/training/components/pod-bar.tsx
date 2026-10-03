import { LuCloud, LuPower } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/common/status-dot"
import { useTerminatePod } from "@/api/training"
import type { TrainJob } from "@/domain/training"
import { formatDateTime, formatDuration, formatRate, formatUsd } from "@/lib/format"

import { ErrorNote } from "./query-state"

/** RunPod pod status bar. Highlights a pod still running after training so it does not keep billing */
export function PodBar({ job }: { job: TrainJob }) {
  const terminate = useTerminatePod()
  const pod = job.podState
  const rate = formatRate(job.pricePerHr ?? 0)
  if (!pod)
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
        <LuCloud className="size-4 shrink-0" aria-hidden />
        GPU 가 비면 {job.gpu} pod 를 띄워 시작합니다. 대기 중에는 요금이 나가지 않습니다.
      </div>
    )

  if (pod.state === "idle") {
    const idleS = pod.idleForS ?? 0
    const idleCost = (job.pricePerHr ?? 0) * (idleS / 3600)
    return (
      <div className="grid gap-2 rounded-md bg-warn-muted px-3 py-2 text-[13px] text-warn">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <LuCloud className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            학습은 {formatDateTime(pod.since)} 에 끝났지만 {job.pod} 가 아직 켜져 있습니다 ({rate}). {formatDuration(idleS)} 동안 약{" "}
            {formatUsd(idleCost)} 가 더 나갔습니다.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-warn/40 bg-background text-warn hover:text-warn"
            disabled={terminate.isPending}
            onClick={() => terminate.mutate(job.id)}
          >
            <LuPower />
            {terminate.isPending ? "Terminating…" : "Terminate now"}
          </Button>
        </div>
        <ErrorNote error={terminate.error} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-[13px]">
      <StatusDot tone={pod.state === "running" ? "info" : "muted"} className="shrink-0 text-[13px]">
        {job.pod}
      </StatusDot>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {pod.state === "running"
          ? `Running, ${rate}. ${pod.autoTerminate ? "학습이 끝나면 자동으로 꺼집니다." : "학습이 끝나도 켜져 있으니 직접 꺼야 합니다."}`
          : `Terminated ${formatDateTime(pod.since)}. 더 이상 요금이 나가지 않습니다.`}
      </span>
    </div>
  )
}
