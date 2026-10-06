import { useState } from "react"
import { Navigate, useParams } from "react-router-dom"
import { LuCircleCheck, LuClock, LuFootprints, LuTimer } from "react-icons/lu"

import { Page, Panel } from "@/components/layout/page-layout"
import { StatStrip } from "@/components/common/stat-strip"
import { ApiError } from "@/api/client"
import { useModel } from "@/api/models"
import { useSimConfig, useSimEnv, useSimEpisodes, useSimJob } from "@/api/simulation"
import { simSuccessRate, type SimEpisode, type SimJob } from "@/domain/simulation"
import { formatDuration, formatPct, plural } from "@/lib/format"

import { EpisodeTable } from "./components/episode-table"
import { FailureReasons } from "./components/failure-reasons"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { RolloutViewer } from "./components/rollout-viewer"
import { SimJobConfig } from "./components/sim-job-config"
import { SimJobActions, SimJobTitle } from "./components/sim-job-header"
import { SimVsReal } from "./components/sim-vs-real"
import { avgSeconds, jobDescription } from "./lib"
import { simPct } from "./lib"

export function SimJobPage() {
  const { jobId = "" } = useParams()
  const query = useSimJob(jobId)
  if (query.error instanceof ApiError && query.error.status === 404) return <Navigate to="/evaluate?target=sim" replace />
  if (!query.data)
    return (
      <Page fit title={jobId} description="Simulation evaluation">
        <Panel className="flex-1">{query.isError ? <ErrorNote error={query.error} onRetry={query.refetch} /> : <LoadingNote />}</Panel>
      </Page>
    )
  return <SimJobView key={query.data.id} job={query.data} />
}

function SimJobView({ job }: { job: SimJob }) {
  const model = useModel(job.modelId).data
  const env = useSimEnv(job.envId).data
  const gpu = useSimConfig().data?.gpu
  // Unfiltered episodes (shared with the table's "All" filter): default selection and the average length
  const episodes = useSimEpisodes(job.id)
  const loaded = episodes.data?.pages.flatMap((p) => p.items) ?? []
  const modelName = model?.name ?? job.modelId
  const done = job.done
  const avg = avgSeconds(loaded)
  const running = job.status === "running"

  // undefined: default (live while running, else the first episode); null: live picked explicitly
  const [picked, setPicked] = useState<SimEpisode | null>()
  const episode = picked === undefined ? (running ? undefined : loaded[0]) : (picked ?? undefined)

  return (
    <Page
      fit
      title={<SimJobTitle job={job} modelName={modelName} />}
      description={jobDescription(job, env)}
      actions={<SimJobActions job={job} />}
    >
      {job.error && <div className="rounded-md bg-bad-muted px-3 py-2.5 text-[13px] text-bad">{job.error}</div>}
      {job.status === "queued" && (
        <div className="rounded-md border px-3 py-2 text-[13px] text-muted-foreground">
          {gpu?.name ?? "GPU"} 가 비면 시작합니다. 앞선 평가가 끝날 때까지 대기합니다.
        </div>
      )}

      <StatStrip
        items={[
          {
            label: "Progress",
            value: `${simPct(done, job.episodes)}%`,
            sub: `${done} / ${plural(job.episodes, "episode")}`,
            icon: LuFootprints,
          },
          {
            label: "Success rate",
            value: formatPct(simSuccessRate(job)),
            sub: done ? `${job.succeeded} of ${done}` : undefined,
            icon: LuCircleCheck,
          },
          {
            label: "Avg episode",
            value: avg === undefined ? "—" : `${avg.toFixed(1)} s`,
            sub: episodes.hasNextPage ? `first ${loaded.length}, limit ${job.maxSeconds} s` : `limit ${job.maxSeconds} s`,
            icon: LuTimer,
          },
          {
            label: "Elapsed",
            value: job.elapsedS != null ? formatDuration(job.elapsedS) : "—",
            sub: running && job.etaS != null ? `ETA ${formatDuration(job.etaS)}` : undefined,
            icon: LuClock,
          },
        ]}
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Scrolls only on short screens where the episode table would get too small */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <RolloutViewer job={job} cameras={env?.cameras ?? ["top", "wrist"]} episode={episode} onShowLive={() => setPicked(null)} />
          <EpisodeTable job={job} selected={episode?.index} onSelect={setPicked} />
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <SimVsReal job={job} model={model} env={env} />
          <FailureReasons job={job} />
          <Panel title="Config" className="shrink-0">
            <SimJobConfig job={job} modelName={modelName} env={env} gpu={gpu} />
          </Panel>
        </div>
      </div>
    </Page>
  )
}
