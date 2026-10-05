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
  SimRunner,
} from "@/domain/simulation"
import type { IsaacDisplay } from "@/domain/settings"

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

// Isaac Sim server

const runnerKey = [...qk.sim, "runner"] as const

/** Server and app state; polled while the app starts so the page follows it */
export const useSimRunner = () =>
  useQuery({
    queryKey: runnerKey,
    queryFn: () => api.get<SimRunner>("/sim/runner"),
    refetchInterval: (q) => (q.state.data?.app?.state === "starting" ? 2000 : 10000),
  })

const onRunner = (r: SimRunner) => queryClient.setQueryData(runnerKey, r)

/** Starts the app (and, in local mode, the server); display defaults to the Connection setting */
export const useStartSimRunner = () =>
  useMutation({ mutationFn: (display?: IsaacDisplay) => api.post<SimRunner>("/sim/runner/start", { display }), onSuccess: onRunner })

export const useStopSimRunner = () => useMutation({ mutationFn: () => api.post<SimRunner>("/sim/runner/stop"), onSuccess: onRunner })

/** Sends the environment folder to the server and opens its scene (starts the app when needed); 409 if the env is invalid */
export const useOpenSimEnv = () =>
  useMutation({ mutationFn: (envId: string) => api.post<SimRunner>(`/sim/envs/${envId}/open`), onSuccess: onRunner })
