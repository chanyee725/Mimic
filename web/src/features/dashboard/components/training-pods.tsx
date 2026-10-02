import { Panel, PanelLink } from "@/components/layout/page-layout"
import { JOBS } from "@/dummy/training"

import { MAX_PODS } from "../lib"
import { PodRow } from "./pod-row"

export function TrainingPods() {
  const running = JOBS.filter((j) => j.status === "running")
  const hidden = running.length - MAX_PODS

  return (
    <Panel title="Training" className="flex-1" action={<PanelLink to="/training">{hidden > 0 ? `+${hidden} more` : "View all"}</PanelLink>}>
      {running.length === 0 ? (
        <p className="text-sm text-muted-foreground">실행 중인 학습이 없습니다.</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
          {running.slice(0, MAX_PODS).map((j) => (
            <PodRow key={j.id} job={j} />
          ))}
        </ul>
      )}
    </Panel>
  )
}
