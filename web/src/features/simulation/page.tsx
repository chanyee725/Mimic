import { Page } from "@/components/layout/page-layout"

import { NewEvalPanel } from "./components/new-eval-panel"
import { SimJobsPanel } from "./components/sim-jobs-panel"

export function SimulationPage() {
  return (
    <Page
      fit
      title="Simulation"
      description="저장한 모델을 Isaac Sim 에서 여러 번 돌려 성공률을 봅니다. 시뮬레이션은 이 스테이션의 RTX 4090 에서만 돕니다."
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SimJobsPanel />
        <NewEvalPanel />
      </div>
    </Page>
  )
}
