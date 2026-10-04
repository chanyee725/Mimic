// Rigs, rig YAML and the teleoperation test — docs/api/rigs.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { Device } from "@/domain/device"
import type { Rig } from "@/domain/rig"
import type { TeleopSamples, TeleopState } from "@/domain/teleop"

import { ApiError, api } from "./client"
import { qk, queryClient } from "./query"

export const useRigs = () => useQuery({ queryKey: [...qk.rigs, "list"], queryFn: () => api.get<Rig[]>("/rigs") })

/** Falls back to the first rig when the id is unknown (404) */
export const useRig = (id: string | undefined) =>
  useQuery({
    queryKey: [...qk.rigs, "detail", id ?? ""],
    queryFn: async () => {
      try {
        return await api.get<Rig>(`/rigs/${id}`)
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e
        const [first] = await api.get<Rig[]>("/rigs")
        if (!first) throw e
        return first
      }
    },
    enabled: !!id,
  })

/** Rig file text (with comments) */
export const useRigYaml = (id: string | undefined) =>
  useQuery({ queryKey: [...qk.rigs, "yaml", id ?? ""], queryFn: () => api.get<string>(`/rigs/${id}/yaml`), enabled: !!id })

/** Connection test of every device in a rig (a few seconds); 503 when LeRobot is unavailable */
export const useTestRig = () =>
  useMutation({
    mutationFn: (rigId: string) => api.post<Device[]>(`/rigs/${rigId}/test`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.devices }),
  })

const teleopKey = (rigId: string) => [...qk.rigs, "teleop", rigId] as const

/**
 * Teleoperation test state, or null when the backend has no session (it was stopped or the backend restarted). Only
 * fetched once a session is known (Start puts it in the cache); polled every 100 ms while it runs
 */
export const useTeleop = (rigId: string) =>
  useQuery({
    queryKey: teleopKey(rigId),
    queryFn: () => api.get<TeleopState>(`/rigs/${rigId}/teleop`).catch(notFoundAsNull),
    enabled: (q) => !!q.state.data?.running,
    retry: false,
    refetchInterval: (q) => (q.state.data?.running ? 100 : false),
  })

const notFoundAsNull = (e: unknown) => {
  if (e instanceof ApiError && e.status === 404) return null
  throw e
}

const teleopStatusKey = (rigId: string) => [...qk.rigs, "teleop-status", rigId] as const

/** Whether the rig's teleop runs (null: no session), checked every second (Capture). Capture start may start it */
export const useTeleopStatus = (rigId: string | undefined) =>
  useQuery({
    queryKey: teleopStatusKey(rigId ?? ""),
    queryFn: () => api.get<TeleopState>(`/rigs/${rigId}/teleop`).catch(notFoundAsNull),
    enabled: !!rigId,
    retry: false,
    refetchInterval: 1000,
  })

/** Teleop samples newer than `after`; null when there is no session */
export const getTeleopSamples = (rigId: string, after: number) =>
  api.get<TeleopSamples>(`/rigs/${rigId}/teleop/samples`, { after }).catch(notFoundAsNull)

export const invalidateTeleopStatus = () => queryClient.invalidateQueries({ queryKey: [...qk.rigs, "teleop-status"] })

/** Connects every leader → follower pair (follower torque on). 409: busy or not calibrated, 503: port missing */
export const useStartTeleop = () =>
  useMutation({
    mutationFn: (rigId: string) => api.post<TeleopState>(`/rigs/${rigId}/teleop`),
    onSuccess: (s) => {
      queryClient.setQueryData(teleopKey(s.rigId), s)
      return invalidateTeleopStatus()
    },
  })

/** Stops the loop and disconnects (follower torque off). A session that is already gone (404) counts as stopped */
export const useStopTeleop = () =>
  useMutation({
    mutationFn: (rigId: string) => api.delete(`/rigs/${rigId}/teleop`).catch(notFoundAsNull),
    onSuccess: (_, rigId) => {
      queryClient.setQueryData<TeleopState | null>(teleopKey(rigId), (s) => (s ? { ...s, running: false } : s))
      void invalidateTeleopStatus()
      return queryClient.invalidateQueries({ queryKey: qk.devices })
    },
  })
