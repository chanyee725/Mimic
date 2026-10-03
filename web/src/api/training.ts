// Training config, jobs, metrics, checkpoints and RunPod pods — docs/api/training.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { Model } from "@/domain/model"
import type { CommandPreview, JobCreate, JobStatus, Metrics, TrainingConfig, TrainJob } from "@/domain/training"

import { API_BASE, api } from "./client"
import { qk, queryClient } from "./query"

const jobKey = (id: string) => [...qk.training, "jobs", id] as const

/** Policy, local GPUs, RunPod catalogue / defaults, lerobot-train params and trainable datasets */
export const useTrainingConfig = () =>
  useQuery({ queryKey: [...qk.training, "config"], queryFn: () => api.get<TrainingConfig>("/training/config"), staleTime: 60_000 })

/** Jobs, newest first */
export const useJobs = (status?: JobStatus) =>
  useQuery({ queryKey: [...qk.training, "jobs", { status }], queryFn: () => api.get<TrainJob[]>("/training/jobs", { status }) })

export const useJob = (id: string | undefined) =>
  useQuery({ queryKey: jobKey(id ?? ""), queryFn: () => api.get<TrainJob>(`/training/jobs/${id}`), enabled: !!id })

/** Metric history averaged into at most `maxPoints` buckets; live steps arrive as training.metrics events */
export const useJobMetrics = (id: string | undefined, { fromStep = 0, maxPoints = 2000 }: { fromStep?: number; maxPoints?: number } = {}) =>
  useQuery({
    queryKey: [...qk.training, "metrics", id, { fromStep, maxPoints }],
    queryFn: () => api.get<Metrics>(`/training/jobs/${id}/metrics`, { fromStep, maxPoints }),
    enabled: !!id,
  })

/** The exact lerobot-train command line of a job */
export const useJobCommand = (id: string | undefined) =>
  useQuery({
    queryKey: [...qk.training, "command", id],
    queryFn: () => api.get<{ command: string }>(`/training/jobs/${id}/command`),
    enabled: !!id,
  })

/** Command line, rate and cost cap for a job that has not started yet (confirm dialog) */
export const useCommandPreview = () =>
  useMutation({ mutationFn: (body: JobCreate) => api.post<CommandPreview>("/training/command-preview", body) })

const onJob = (job: TrainJob) => {
  queryClient.setQueryData(jobKey(job.id), job)
  return queryClient.invalidateQueries({ queryKey: qk.training })
}

/** Start (or queue, when the local GPU is busy) a training job */
export const useStartJob = () =>
  useMutation({ mutationFn: (body: JobCreate) => api.post<TrainJob>("/training/jobs", body), onSuccess: onJob })

/** Stop an active job; it saves a last checkpoint */
export const useStopJob = () =>
  useMutation({ mutationFn: (id: string) => api.post<TrainJob>(`/training/jobs/${id}/stop`), onSuccess: onJob })

export const useTerminatePod = () =>
  useMutation({ mutationFn: (id: string) => api.post<TrainJob>(`/training/jobs/${id}/pod/terminate`), onSuccess: onJob })

/** Save a checkpoint as a model (Models page) */
export const useSaveCheckpoint = () =>
  useMutation({
    mutationFn: ({ jobId, step, name }: { jobId: string; step: number; name: string }) =>
      api.post<Model>(`/training/jobs/${jobId}/checkpoints/${step}/save`, { name }),
    onSuccess: () => Promise.all([qk.models, qk.training].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })

/** Push a checkpoint to the HF Hub; repo defaults to <hf namespace>/smolvla_<task> */
export const usePushCheckpoint = () =>
  useMutation({
    mutationFn: ({ jobId, step, repo }: { jobId: string; step: number; repo?: string }) =>
      api.post<{ repo: string }>(`/training/jobs/${jobId}/checkpoints/${step}/push`, { repo }),
  })

/** Zip download of a checkpoint folder (501 until storage lands) */
export const checkpointDownloadUrl = (jobId: string, step: number) => `${API_BASE}/training/jobs/${jobId}/checkpoints/${step}/download`
