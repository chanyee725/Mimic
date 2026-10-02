import { DetailList } from "@/components/common/detail-list"
import { SIM_GPU } from "@/api/simulation"
import type { SimJob, SimScene } from "@/domain/simulation"
import { plural } from "@/lib/format"

import { randomizationLabel, seedRange } from "../job-stats"

/** Evaluation config summary (model, scene, episodes, randomization, ...) */
export function SimJobConfig({ job, modelName, scene }: { job: SimJob; modelName: string; scene?: SimScene }) {
  return (
    <DetailList
      rows={[
        { k: "Model", v: modelName },
        { k: "Scene", v: scene?.name ?? job.sceneId },
        ...(scene
          ? [
              { k: "USD", v: <span title={scene.usd}>{scene.usd}</span> },
              { k: "Cameras", v: scene.cameras.join(", ") },
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
