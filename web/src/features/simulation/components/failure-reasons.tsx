import { Panel } from "@/components/layout/page-layout"
import { ProgressBar } from "@/components/common/progress-bar"
import type { SimJob } from "@/domain/simulation"

import { failureReasons } from "../job-stats"

/** Failed episodes grouped by the environment's success check reason */
export function FailureReasons({ job }: { job: SimJob }) {
  const reasons = failureReasons(job.results)
  const fails = reasons.reduce((a, r) => a + r.count, 0)

  let empty = "실패한 에피소드가 없습니다."
  if (job.results.length === 0) empty = job.status === "queued" ? "GPU 가 비면 시작합니다." : "실행된 에피소드가 없습니다."

  return (
    <Panel
      title="Failure reasons"
      className="shrink-0"
      action={fails > 0 && <span className="text-xs text-muted-foreground tabular-nums">{fails} failed</span>}
    >
      {reasons.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2.5">
          {reasons.map((r) => (
            <li key={r.reason} className="grid gap-1">
              <span className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate">{r.reason}</span>
                <span className="text-muted-foreground tabular-nums">{r.count}</span>
              </span>
              <ProgressBar value={(r.count / fails) * 100} label={r.reason} tone="bad" size="xs" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
