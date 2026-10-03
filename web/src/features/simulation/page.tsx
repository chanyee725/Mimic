import { useSearchParams } from "react-router-dom"

import { Segmented } from "@/components/common/segmented"
import { Page } from "@/components/layout/page-layout"
import { listSimEnvs, listSimJobs } from "@/api/simulation"

import { EnvironmentsView } from "./components/environments-view"
import { NewEvalPanel } from "./components/new-eval-panel"
import { SimJobsPanel } from "./components/sim-jobs-panel"

type View = "evaluations" | "environments"

export function SimulationPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get("view") === "environments" ? "environments" : "evaluations"
  // ?env=<id> preselects an environment in the new evaluation form
  const envId = params.get("env") ?? undefined

  return (
    <Page
      fit
      title="Simulation"
      description="직접 만든 Isaac Sim 환경을 폴더에 등록하면, 저장한 모델을 그 환경에 불러와 여러 번 돌려 성공률을 봅니다. 시뮬레이션은 이 스테이션의 RTX 4090 에서만 돕니다."
      actions={
        <Segmented
          label="View"
          value={view}
          onChange={(v) => setParams(v === "evaluations" ? {} : { view: v }, { replace: true })}
          options={[
            { value: "evaluations", label: "Evaluations", count: listSimJobs().length },
            { value: "environments", label: "Environments", count: listSimEnvs().length },
          ]}
        />
      }
    >
      {view === "environments" ? (
        <EnvironmentsView />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SimJobsPanel />
          <NewEvalPanel key={envId} initialEnvId={envId} />
        </div>
      )}
    </Page>
  )
}
