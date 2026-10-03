import { useMutation } from "@tanstack/react-query"

import { checkpointDownloadUrl, usePushCheckpoint, useSaveCheckpoint } from "@/api/training"
import type { TrainJob } from "@/domain/training"
import { plural } from "@/lib/format"

import { checkpointModelName, downloadFile } from "../lib"

type Action = "save" | "push" | "download"

/**
 * Save to Models / Push to HF Hub / Download for one or more checkpoints of a job.
 * One action at a time; `result` is a short summary of the last success, `error` the server's message.
 */
export function useCheckpointActions(job: TrainJob) {
  const save = useSaveCheckpoint()
  const push = usePushCheckpoint()
  const action = useMutation({
    mutationFn: async ({ kind, steps }: { kind: Action; steps: number[] }) => {
      if (kind === "download") {
        for (const step of steps) await downloadFile(checkpointDownloadUrl(job.id, step))
        return `Downloaded ${plural(steps.length, "checkpoint")}`
      }
      if (kind === "save") {
        for (const step of steps) await save.mutateAsync({ jobId: job.id, step, name: checkpointModelName(job, step) })
        return `Saved ${plural(steps.length, "checkpoint")} to Models`
      }
      const repos = new Set<string>()
      for (const step of steps) repos.add((await push.mutateAsync({ jobId: job.id, step })).repo)
      return `Pushing ${plural(steps.length, "checkpoint")} to ${[...repos].join(", ")}`
    },
  })

  return {
    run: (kind: Action, steps: number[]) => action.mutate({ kind, steps }),
    pending: action.isPending ? action.variables.kind : undefined,
    result: action.data,
    error: action.error,
    reset: action.reset,
  }
}
