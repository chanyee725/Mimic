import { DetailList } from "@/components/common/detail-list"
import type { SimEnv, SimGpu, SimJob } from "@/domain/simulation"
import { formatDateTime, plural } from "@/lib/format"

import { randomizationLabel, seedRange } from "../lib"

/** Evaluation config summary (model, environment, episodes, randomization, ...) */
export function SimJobConfig({ job, modelName, env, gpu }: { job: SimJob; modelName: string; env?: SimEnv; gpu?: SimGpu }) {
  return (
    <DetailList
      rows={[
        { k: "Model", v: modelName },
        { k: "Environment", v: env?.name ?? job.envId },
        ...(env ? [{ k: "Scene", v: <span title={env.path}>{env.scene}</span> }] : []),
        { k: "Episodes", v: plural(job.episodes, "episode") },
        { k: "Randomization", v: randomizationLabel(job) },
        { k: "Seeds", v: seedRange(job) },
        { k: "Time limit", v: `${job.maxSeconds} s per episode` },
        { k: "GPU", v: gpu ? `${gpu.name} (${gpu.id})` : "—" },
        { k: "Started", v: job.startedAt ? formatDateTime(job.startedAt) : "Not started" },
      ]}
    />
  )
}
