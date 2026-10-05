import { useSearchParams } from "react-router-dom"

import { Segmented } from "@/components/common/segmented"
import { Page } from "@/components/layout/page-layout"
import { useSimEnvs, useSimJobs } from "@/api/simulation"

import { EnvironmentsView } from "./components/environments-view"
import { NewEvalPanel } from "./components/new-eval-panel"
import { SimJobsPanel } from "./components/sim-jobs-panel"

type View = "evaluations" | "environments"

export function SimulationPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get("view") === "environments" ? "environments" : "evaluations"
  // ?env=<id>&model=<id> preselect the environment and model in the new evaluation form
  const envId = params.get("env") ?? undefined
  const modelId = params.get("model") ?? undefined
  const jobs = useSimJobs()
  const envs = useSimEnvs()

  return (
    <Page
      fit
      title="Simulation"
      description="직접 만든 Isaac Sim 환경을 폴더에 등록하면, 저장한 모델을 그 환경에 불러와 여러 번 돌려 성공률을 봅니다. Isaac Sim 은 이 스테이션이나 시뮬레이션 서버에서 돕니다 (Settings → Connection)."
      actions={
        <Segmented
          label="View"
          value={view}
          onChange={(v) => setParams(v === "evaluations" ? {} : { view: v }, { replace: true })}
          options={[
            { value: "evaluations", label: "Evaluations", count: jobs.data?.length },
            { value: "environments", label: "Environments", count: envs.data?.length },
          ]}
        />
      }
    >
      {view === "environments" ? (
        <EnvironmentsView />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <SimJobsPanel />
          <NewEvalPanel key={`${envId}/${modelId}`} initialEnvId={envId} initialModelId={modelId} />
        </div>
      )}
    </Page>
  )
}
