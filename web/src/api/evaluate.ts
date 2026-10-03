// Real-robot evaluation runs — docs/api/models.md (Evaluate)
import { useMutation, useQuery } from "@tanstack/react-query"

import type { EvalJudgement, EvalRun, EvalRunCreate } from "@/domain/evaluate"

import { api } from "./client"
import { qk, queryClient } from "./query"

const runKey = (id: string) => [...qk.evaluate, "runs", id] as const

/** Runs of the current session (server start), optionally for one model */
export const useEvalRuns = (modelId?: string) =>
  useQuery({ queryKey: [...qk.evaluate, "runs", { modelId }], queryFn: () => api.get<EvalRun[]>("/evaluate/runs", { modelId }) })

/** One run; polls while it is running so the timer and the automatic move to judging show up */
export const useEvalRun = (id: string | undefined) =>
  useQuery({
    queryKey: runKey(id ?? ""),
    queryFn: () => api.get<EvalRun>(`/evaluate/runs/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.state === "running" ? 1000 : false),
  })

const onRun = (run: EvalRun) => {
  queryClient.setQueryData(runKey(run.id), run)
  return Promise.all([qk.evaluate, qk.models].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/** Run the policy on the robot */
export const useStartEvalRun = () =>
  useMutation({ mutationFn: (body: EvalRunCreate) => api.post<EvalRun>("/evaluate/runs", body), onSuccess: onRun })

/** Stop a running run; it moves to judging */
export const useStopEvalRun = () =>
  useMutation({ mutationFn: (id: string) => api.post<EvalRun>(`/evaluate/runs/${id}/stop`), onSuccess: onRun })

/** Judge a run; success / fail count towards the model's current evaluation */
export const useEvalResult = () =>
  useMutation({
    mutationFn: ({ id, result }: { id: string; result: EvalJudgement }) => api.post<EvalRun>(`/evaluate/runs/${id}/result`, { result }),
    onSuccess: onRun,
  })
