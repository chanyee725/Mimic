// Simulation: Isaac Sim environments (Python scripts) and evaluation jobs. Spec: docs/api/simulation.md
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"

import type {
  RescanResult,
  SimAsset,
  SimAssetKind,
  SimConfig,
  SimEnv,
  SimEpisode,
  SimEpisodeResult,
  SimJog,
  SimJob,
  SimJobCreate,
  SimJobStatus,
  SimRunner,
  SimTeleop,
  SimTeleopCreate,
} from "@/domain/simulation"
import { isSimTeleopActive } from "@/domain/simulation"
import type { IsaacDisplay } from "@/domain/settings"

import { API_BASE, api, type Page } from "./client"
import { qk, queryClient } from "./query"

const envsKey = [...qk.sim, "envs"] as const
const jobsKey = [...qk.sim, "jobs"] as const

/** Environments folder and the GPU Isaac Sim runs on (gpu.busyBy = the job holding it) */
export const useSimConfig = () => useQuery({ queryKey: [...qk.sim, "config"], queryFn: () => api.get<SimConfig>("/sim/config") })

/** Environments from the last folder scan */
export const useSimEnvs = () => useQuery({ queryKey: [...envsKey, "list"], queryFn: () => api.get<SimEnv[]>("/sim/envs") })

export const useSimEnv = (id: string | undefined) =>
  useQuery({ queryKey: [...envsKey, id], queryFn: () => api.get<SimEnv>(`/sim/envs/${id}`), enabled: !!id })

/** Rescans the environments folder */
export const useRescanEnvs = () =>
  useMutation({
    mutationFn: () => api.post<RescanResult>("/sim/envs/rescan"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sim }),
  })

/** Robot USDs an environment can be tagged with */
export const useSimRobots = () => useQuery({ queryKey: [...qk.sim, "robots"], queryFn: () => api.get<SimAsset[]>("/sim/robots") })

/** End-effector USDs (robot hands, grippers) under data/sims/tools/ */
export const useSimTools = () => useQuery({ queryKey: [...qk.sim, "tools"], queryFn: () => api.get<SimAsset[]>("/sim/tools") })

/** Replaces the environment's robot tags (saved in data/sims/envs.yaml) */
export const useSetEnvRobots = () =>
  useMutation({
    mutationFn: ({ id, robots }: { id: string; robots: string[] }) => api.patch<SimEnv>(`/sim/envs/${encodeURIComponent(id)}`, { robots }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sim }),
  })

/** Removes the environment's file or folder; 409 with details.tasks while a task uses it */
export const useDeleteSimEnv = () =>
  useMutation({
    mutationFn: (id: string) => api.delete(`/sim/envs/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sim }),
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

/** Starts an evaluation (queued when the GPU is busy); 422 for an unknown model or environment */
export const useStartSimJob = () =>
  useMutation({ mutationFn: (body: SimJobCreate) => api.post<SimJob>("/sim/jobs", body), onSuccess: onJob })

/** 409 if the job is not running or queued */
export const useStopSimJob = () => useMutation({ mutationFn: (id: string) => api.post<SimJob>(`/sim/jobs/${id}/stop`), onSuccess: onJob })

/** Thumbnail image of an environment (404 when it has none) */
export const simEnvThumbnailUrl = (id: string) => `${API_BASE}/sim/envs/${encodeURIComponent(id)}/thumbnail`

/** glTF binary (Y-up, meters) of a robot or tool USD; 422 when it has no mesh or conversion fails */
export const simAssetModelUrl = (kind: SimAssetKind, id: string) => `${API_BASE}/sim/${kind}s/${encodeURIComponent(id)}/model.glb`

/** The model as bytes for the 3D preview. The first request converts the USD (up to ~30 s), so no retries */
export const useSimAssetModel = (kind: SimAssetKind, id: string, updatedAt: string) =>
  useQuery({
    queryKey: [...qk.sim, "model", kind, id, updatedAt],
    queryFn: () => api.getBuffer(simAssetModelUrl(kind, id)),
    staleTime: Infinity,
    retry: false,
  })

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

/** Sends the environment to the server, which builds its stage (starts the app when needed) */
export const useOpenSimEnv = () =>
  useMutation({ mutationFn: (envId: string) => api.post<SimRunner>(`/sim/envs/${envId}/open`), onSuccess: onRunner })

/** Opens one robot or tool alone on an empty stage (starts the app when needed) */
export const useOpenSimAsset = () =>
  useMutation({
    mutationFn: ({ kind, id }: { kind: SimAssetKind; id: string }) => api.post<SimRunner>(`/sim/${kind}s/${encodeURIComponent(id)}/open`),
    onSuccess: onRunner,
  })

// Teleoperation: a real leader arm drives a robot opened alone in Isaac Sim

const teleopKey = [...qk.sim, "teleop"] as const

/** Current sim teleoperation (null when none); polled every 500 ms while it starts or runs */
export const useSimTeleop = (enabled = true) =>
  useQuery({
    queryKey: teleopKey,
    queryFn: () => api.get<SimTeleop | null>("/sim/teleop"),
    enabled,
    refetchInterval: (q) => (isSimTeleopActive(q.state.data) ? 500 : false),
  })

/**
 * Opens the robot alone in Isaac Sim (starting the app when needed) and streams the leader's joints to it.
 * 404 unknown robot / device; 422 not a leader or not one of the robot's teleop types; 409 device busy or a session runs;
 * 503 LeRobot unavailable or the port does not open
 */
export const useStartSimTeleop = () =>
  useMutation({
    mutationFn: (body: SimTeleopCreate) => api.post<SimTeleop>("/sim/teleop", body),
    onSuccess: (t) => {
      queryClient.setQueryData(teleopKey, t)
      return queryClient.invalidateQueries({ queryKey: qk.sim })
    },
  })

/** Disconnects the leader; the Isaac Sim scene stays open. 404 when none */
/** The leader, held in the robot's initial pose, is read and saved as its rest (robot.yaml leader.rest) */
export const useCaptureLeaderRest = () =>
  useMutation({
    mutationFn: ({ robotId, deviceId }: { robotId: string; deviceId: string }) =>
      api.post<SimAsset>(`/sim/robots/${encodeURIComponent(robotId)}/leader-rest`, { deviceId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sim }),
  })

/** Keyboard teleoperation: joint speeds or a TCP twist to move with now. Fire and forget, resent while keys are held */
export const sendSimJog = (body: SimJog) => api.put("/sim/teleop/jog", body).catch(() => undefined)

export const useStopSimTeleop = () =>
  useMutation({
    mutationFn: () => api.delete("/sim/teleop"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sim }),
  })
