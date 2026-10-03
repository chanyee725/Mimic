import { Panel } from "@/components/layout/page-layout"
import { ProgressBar } from "@/components/common/progress-bar"
import { successRate, type Model } from "@/domain/model"
import { simSuccessRate, type SimJob, type SimEnv } from "@/domain/simulation"
import { formatPct, plural } from "@/lib/format"

import { successCount } from "../job-stats"

/** Gap (%p) under which sim and real are treated as matching */
const CLOSE_GAP = 5

/** Sim success rate next to the model's real-robot success from Evaluate */
export function SimVsReal({ job, model, env }: { job: SimJob; model?: Model; env?: SimEnv }) {
  const sim = simSuccessRate(job)
  const real = model ? successRate(model) : undefined
  const trials = model?.evals.reduce((a, e) => a + e.trials, 0) ?? 0
  const gap = sim !== undefined && real !== undefined ? Math.round((sim - real) * 100) : undefined

  let note: string
  if (sim === undefined) note = "에피소드가 끝나면 실제 결과와 비교합니다."
  else if (gap === undefined) note = "Evaluate 에서 실제 로봇으로 평가하면 차이를 볼 수 있습니다."
  else if (Math.abs(gap) <= CLOSE_GAP) note = "시뮬레이션과 실제 결과가 비슷합니다."
  else if (gap > 0) note = `시뮬레이션이 실제보다 ${gap}%p 높습니다. 실제 로봇에서 한 번 더 확인하세요.`
  else note = `시뮬레이션이 실제보다 ${-gap}%p 낮습니다. 장면이나 randomization 이 실제보다 어려울 수 있습니다.`

  return (
    <Panel title="Sim vs real" className="shrink-0">
      <div className="grid gap-3">
        <Row
          label="Isaac Sim"
          value={formatPct(sim)}
          sub={sim === undefined ? "No episodes yet" : `${successCount(job.results)} of ${plural(job.results.length, "episode")}`}
          pct={(sim ?? 0) * 100}
          tone="info"
        />
        <Row
          label="Real robot"
          value={formatPct(real)}
          sub={real === undefined ? "Not evaluated on the robot yet" : `${plural(trials, "trial")} from Evaluate`}
          pct={(real ?? 0) * 100}
          tone="ok"
        />
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
      {env && !env.calibrated && (
        <p className="rounded-md bg-warn-muted px-2.5 py-2 text-xs text-warn">
          이 환경은 아직 rig 와 맞춰지지 않아 차이가 클 수 있습니다{env.description ? ` (${env.description})` : ""}.
        </p>
      )}
    </Panel>
  )
}

function Row({ label, value, sub, pct, tone }: { label: string; value: string; sub: string; pct: number; tone: "info" | "ok" }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span>{label}</span>
        <span className="font-mono font-medium tabular-nums">{value}</span>
      </div>
      <ProgressBar value={pct} label={`${label} success rate`} tone={tone} />
      <span className="text-xs text-muted-foreground tabular-nums">{sub}</span>
    </div>
  )
}
