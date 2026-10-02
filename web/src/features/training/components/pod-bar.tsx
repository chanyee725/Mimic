import { LuCloud, LuPower } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { StatusDot } from "@/components/common/status-dot"
import type { PodState, TrainJob } from "@/domain/training"
import { formatRate, formatUsd, parseDuration } from "@/lib/format"

/** RunPod pod status bar. Highlights a pod still running after training so it does not keep billing */
export function PodBar({ job, pod, onTerminate }: { job: TrainJob; pod?: PodState; onTerminate: () => void }) {
  const rate = formatRate(job.pricePerHr ?? 0)
  if (!pod)
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
        <LuCloud className="size-4 shrink-0" aria-hidden />
        GPU 가 비면 {job.gpu} pod 를 띄워 시작합니다. 대기 중에는 요금이 나가지 않습니다.
      </div>
    )

  if (pod.state === "idle") {
    const idleCost = (job.pricePerHr ?? 0) * (parseDuration(pod.idleFor) / 3600)
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-warn-muted px-3 py-2 text-[13px] text-warn">
        <LuCloud className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          학습은 {pod.since} 에 끝났지만 {job.pod} 가 아직 켜져 있습니다 ({rate}). {pod.idleFor} 동안 약 {formatUsd(idleCost)} 가 더
          나갔습니다.
        </span>
        <Button size="sm" variant="outline" className="h-7 border-warn/40 bg-background text-warn hover:text-warn" onClick={onTerminate}>
          <LuPower />
          Terminate now
        </Button>
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
          : `Terminated ${pod.since}. 더 이상 요금이 나가지 않습니다.`}
      </span>
    </div>
  )
}
