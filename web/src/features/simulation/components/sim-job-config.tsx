import { DetailList } from "@/components/common/detail-list"
import { SIM_GPU } from "@/api/simulation"
import type { SimJob, SimEnv } from "@/domain/simulation"
import { plural } from "@/lib/format"

import { randomizationLabel, seedRange } from "../job-stats"

/** Evaluation config summary (model, environment, episodes, randomization, ...) */
export function SimJobConfig({ job, modelName, env }: { job: SimJob; modelName: string; env?: SimEnv }) {
  return (
    <DetailList
      rows={[
        { k: "Model", v: modelName },
        { k: "Environment", v: env?.name ?? job.envId },
        ...(env
          ? [
              { k: "Folder", v: <span title={env.path}>{env.path}</span> },
              { k: "Cameras", v: env.cameras.join(", ") },
            ]
          : []),
        { k: "Episodes", v: plural(job.episodes, "episode") },
        { k: "Randomization", v: randomizationLabel(job) },
        { k: "Seeds", v: seedRange(job) },
        { k: "Time limit", v: `${job.maxSeconds} s per episode` },
        { k: "GPU", v: `${SIM_GPU.name} (${SIM_GPU.id})` },
        { k: "Started", v: job.startedAt ?? "Not started" },
      ]}
    />
  )
}
