import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { Segmented } from "@/components/common/segmented"
import { useModels } from "@/api/models"
import { useSimEnvs, useSimJobs } from "@/api/simulation"
import { isSimActive } from "@/domain/simulation"

import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { SimJobRow } from "./sim-job-row"

type Tab = "all" | "active" | "finished"

/** Evaluation list, filtered by all, running or finished */
export function SimJobsPanel() {
  const [tab, setTab] = useState<Tab>("all")
  const query = useSimJobs()
  // Names only; rows fall back to the ids while these load
  const models = useModels().data ?? []
  const envs = useSimEnvs().data ?? []
  const jobs = query.data ?? []
  const active = jobs.filter(isSimActive)
  const finished = jobs.filter((j) => !isSimActive(j))
  const shown = tab === "all" ? jobs : tab === "active" ? active : finished

  return (
    <Panel
      className="min-h-0 flex-1"
      title="Evaluations"
      action={
        <Segmented
          label="Evaluations"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: query.data && jobs.length },
            { value: "active", label: "Running", count: query.data && active.length },
            { value: "finished", label: "Finished", count: query.data && finished.length },
          ]}
        />
      }
    >
      {query.isPending ? (
        <LoadingNote />
      ) : query.isError ? (
        <ErrorNote error={query.error} onRetry={query.refetch} />
      ) : shown.length === 0 ? (
        <p className="grid flex-1 place-items-center py-10 text-[13px] text-muted-foreground">
          {tab !== "finished" ? "돌고 있는 평가가 없습니다. 오른쪽에서 평가를 시작하세요." : "끝난 평가가 없습니다."}
        </p>
      ) : (
        <ul className="-mx-3 grid min-h-0 content-start gap-1 overflow-y-auto">
          {shown.map((j) => (
            <SimJobRow
              key={j.id}
              job={j}
              modelName={models.find((m) => m.id === j.modelId)?.name}
              envName={envs.find((e) => e.id === j.envId)?.name}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}
