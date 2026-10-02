import { useState } from "react"
import { Navigate, useParams } from "react-router-dom"
import { LuCircleCheck, LuClock, LuFootprints, LuTimer } from "react-icons/lu"

import { Page, Panel } from "@/components/layout/page-layout"
import { StatStrip } from "@/components/common/stat-strip"
import { getModel } from "@/api/models"
import { SIM_GPU, getSimJob, getSimScene } from "@/api/simulation"
import { simSuccessRate, type SimJob } from "@/domain/simulation"
import { formatPct } from "@/lib/format"

import { EpisodeTable } from "./components/episode-table"
import { FailureReasons } from "./components/failure-reasons"
import { RolloutViewer } from "./components/rollout-viewer"
import { SimJobConfig } from "./components/sim-job-config"
import { SimJobActions, SimJobTitle } from "./components/sim-job-header"
import { SimVsReal } from "./components/sim-vs-real"
import { avgSeconds, jobDescription, successCount } from "./job-stats"
import { simPct } from "./lib"

export function SimJobPage() {
  const { jobId = "" } = useParams()
  const job = getSimJob(jobId)
  if (!job) return <Navigate to="/simulation" replace />
  return <SimJobView key={job.id} job={job} />
}

function SimJobView({ job }: { job: SimJob }) {
  const model = getModel(job.modelId)
  const scene = getSimScene(job.sceneId)
  const modelName = model?.name ?? job.modelId
  const done = job.results.length
  const avg = avgSeconds(job.results)
  const running = job.status === "running"

  // Running jobs show the live rollout until an episode is picked; others open on the first episode
  const [selected, setSelected] = useState<number | undefined>(running ? undefined : job.results[0]?.index)
  const episode = job.results.find((e) => e.index === selected)

  return (
    <Page
      fit
      title={<SimJobTitle job={job} modelName={modelName} />}
      description={jobDescription(job, scene)}
      actions={<SimJobActions job={job} />}
    >
      {job.error && <div className="rounded-md bg-bad-muted px-3 py-2.5 text-[13px] text-bad">{job.error}</div>}
      {job.status === "queued" && (
        <div className="rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
          {SIM_GPU.name} 가 비면 시작합니다. 앞선 평가가 끝날 때까지 대기합니다.
        </div>
      )}

      <StatStrip
        items={[
          { label: "Progress", value: `${simPct(done, job.episodes)}%`, sub: `${done} / ${job.episodes} episodes`, icon: LuFootprints },
          {
            label: "Success rate",
            value: formatPct(simSuccessRate(job)),
            sub: done ? `${successCount(job.results)} of ${done}` : undefined,
            icon: LuCircleCheck,
          },
          { label: "Avg episode", value: avg === undefined ? "—" : `${avg.toFixed(1)} s`, sub: `limit ${job.maxSeconds} s`, icon: LuTimer },
          { label: "Elapsed", value: job.elapsed ?? "—", sub: running && job.eta ? `ETA ${job.eta}` : undefined, icon: LuClock },
        ]}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Scrolls only on short screens where the episode table would get too small */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <RolloutViewer
            job={job}
            cameras={scene?.cameras ?? ["top", "wrist"]}
            episode={episode}
            onShowLive={() => setSelected(undefined)}
          />
          <EpisodeTable job={job} selected={selected} onSelect={setSelected} />
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <SimVsReal job={job} model={model} scene={scene} />
          <FailureReasons job={job} />
          <Panel title="Config" className="shrink-0">
            <SimJobConfig job={job} modelName={modelName} scene={scene} />
          </Panel>
        </div>
      </div>
    </Page>
  )
}
