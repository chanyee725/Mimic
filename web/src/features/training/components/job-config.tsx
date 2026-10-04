import { DetailList } from "@/components/common/detail-list"
import { useTrainingConfig } from "@/api/training"
import type { TrainJob } from "@/domain/training"
import { formatDateTime } from "@/lib/format"

import { computeText } from "../lib"

/** Job config summary (model, dataset, compute, steps, ...) */
export function JobConfig({ job }: { job: TrainJob }) {
  const policyBase = useTrainingConfig().data?.policyBase
  return (
    <DetailList
      rows={[
        { k: "Model", v: policyBase ? `${job.policy} (${policyBase})` : job.policy },
        { k: "Dataset", v: job.dataset },
        { k: "Compute", v: computeText(job) },
        ...(job.pod ? [{ k: "Pod", v: job.pod }] : []),
        { k: "Steps", v: job.total.toLocaleString() },
        { k: "Batch size", v: String(job.batch) },
        { k: "Epochs", v: String(job.epochs) },
        { k: "Started", v: job.startedAt ? formatDateTime(job.startedAt) : "Not started" },
      ]}
    />
  )
}
