// Episode recording control — spec: docs/api/capture.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { CaptureState } from "@/domain/capture"
import type { Recording } from "@/domain/recording"
import type { Outcome } from "@/domain/task"

import { api } from "./client"
import { qk, queryClient } from "./query"

const stateKey = [...qk.capture, "state"] as const

/** Current phase; capture.state events refetch it */
export function useCaptureState() {
  return useQuery({ queryKey: stateKey, queryFn: () => api.get<CaptureState>("/capture/state") })
}

const setState = (s: CaptureState) => queryClient.setQueryData(stateKey, s)

/** Transition mutations; each one writes the returned state into the cache */
export function useCaptureActions() {
  const start = useMutation({
    mutationFn: (body: { taskId: string; operator: string }) => api.post<CaptureState>("/capture/start", body),
    onSuccess: setState,
  })
  const subtask = useMutation({
    mutationFn: (index: number) => api.post<CaptureState>("/capture/subtask", { index }),
    onSuccess: setState,
  })
  const stop = useMutation({
    mutationFn: () => api.post<CaptureState>("/capture/stop"),
    onSuccess: setState,
  })
  const save = useMutation({
    mutationFn: (outcome: Outcome) => api.post<Recording>("/capture/save", { outcome }),
    onSuccess: () => {
      for (const key of [qk.capture, qk.recordings, qk.convert, qk.tasks]) queryClient.invalidateQueries({ queryKey: key })
    },
  })
  const rerecord = useMutation({
    mutationFn: () => api.post<CaptureState>("/capture/rerecord"),
    onSuccess: setState,
  })
  const discard = useMutation({
    mutationFn: () => api.post<CaptureState>("/capture/discard"),
    onSuccess: setState,
  })
  return { start, subtask, stop, save, rerecord, discard }
}
