import { DetailList } from "@/components/app/detail-list"
import { POLICY_BASE, type TrainJob } from "@/dummy/training"

import { computeText } from "../lib"

/** Job 설정 요약 (모델 · 데이터셋 · 컴퓨트 · step 수 등) */
export function JobConfig({ job }: { job: TrainJob }) {
  return (
    <DetailList
      rows={[
        { k: "Model", v: `${job.policy} (${POLICY_BASE})` },
        { k: "Dataset", v: job.dataset },
        { k: "Compute", v: computeText(job) },
        ...(job.pod ? [{ k: "Pod", v: job.pod }] : []),
        { k: "Steps", v: job.total.toLocaleString() },
        { k: "Batch size", v: String(job.batch) },
        { k: "Epochs", v: String(job.epochs) },
        { k: "Started", v: job.startedAt ?? "Not started" },
      ]}
    />
  )
}
