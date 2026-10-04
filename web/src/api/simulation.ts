// Simulation: Isaac Sim environments, model compatibility and evaluation jobs. Spec: docs/api/simulation.md
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"

import type {
  ModelCompat,
  RescanResult,
  SimConfig,
  SimEnv,
  SimEnvState,
  SimEpisode,
  SimEpisodeResult,
  SimJob,
  SimJobCreate,
  SimJobStatus,
} from "@/domain/simulation"

import { API_BASE, api, type Page } from "./client"
import { qk, queryClient } from "./query"

const envsKey = [...qk.sim, "envs"] as const
const jobsKey = [...qk.sim, "jobs"] as const

/** Environments folder and the GPU Isaac Sim runs on (gpu.busyBy = the job holding it) */
export const useSimConfig = () => useQuery({ queryKey: [...qk.sim, "config"], queryFn: () => api.get<SimConfig>("/sim/config") })

/** Environments from the last folder scan */
export const useSimEnvs = (state?: SimEnvState) =>
  useQuery({ queryKey: [...envsKey, "list", state ?? null], queryFn: () => api.get<SimEnv[]>("/sim/envs", { state }) })

export const useSimEnv = (id: string | undefined) =>
  useQuery({ queryKey: [...envsKey, id], queryFn: () => api.get<SimEnv>(`/sim/envs/${id}`), enabled: !!id })

/** Rescans the environments folder */
export const useRescanEnvs = () =>
  useMutation({
    mutationFn: () => api.post<RescanResult>("/sim/envs/rescan"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sim }),
  })

/** Every saved model checked against this environment: task models first, other usable ones, then blocked ones */
export const useEnvCompat = (envId: string | undefined) =>
  useQuery({
    queryKey: [...envsKey, envId, "compat"],
    queryFn: () => api.get<ModelCompat[]>(`/sim/envs/${envId}/compat`),
    enabled: !!envId,
  })

/** Evaluation jobs, newest first */
export const useSimJobs = (status?: SimJobStatus) =>
  useQuery({ queryKey: [...jobsKey, "list", status ?? null], queryFn: () => api.get<SimJob[]>("/sim/jobs", { status }) })

export const useSimJob = (id: string | undefined) =>
  useQuery({ queryKey: [...jobsKey, id], queryFn: () => api.get<SimJob>(`/sim/jobs/${id}`), enabled: !!id })

/** Finished episodes of a job by index (cursor paged) */
export const useSimEpisodes = (jobId: string | undefined, result?: SimEpisodeResult) =>
  useInfiniteQuery({
    queryKey: [...jobsKey, jobId, "episodes", result ?? null],
    queryFn: ({ pageParam }) => api.get<Page<SimEpisode>>(`/sim/jobs/${jobId}/episodes`, { result, cursor: pageParam, limit: 100 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: !!jobId,
  })

function onJob(job: SimJob) {
  queryClient.setQueryData([...jobsKey, job.id], job)
  return queryClient.invalidateQueries({ queryKey: qk.sim })
}

/** Starts an evaluation (queued when the GPU is busy); 422 with details.issues if the pair is incompatible */
export const useStartSimJob = () =>
  useMutation({ mutationFn: (body: SimJobCreate) => api.post<SimJob>("/sim/jobs", body), onSuccess: onJob })

/** 409 if the job is not running or queued */
export const useStopSimJob = () => useMutation({ mutationFn: (id: string) => api.post<SimJob>(`/sim/jobs/${id}/stop`), onSuccess: onJob })

/** Rollout video of one episode (501 until Isaac Sim is connected) */
export const simEpisodeVideoUrl = (jobId: string, index: number, camera: string) =>
  `${API_BASE}/sim/jobs/${encodeURIComponent(jobId)}/episodes/${index}/video/${encodeURIComponent(camera)}`
