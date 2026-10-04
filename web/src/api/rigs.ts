// Rigs, rig YAML and the teleoperation test — docs/api/rigs.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { Rig } from "@/domain/rig"
import type { TeleopState } from "@/domain/teleop"

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

const teleopKey = (rigId: string) => [...qk.rigs, "teleop", rigId] as const

/**
 * Teleoperation test state. Only fetched once a session is known (Start puts it in the cache), so there is no 404 for
 * "none"; polled every 100 ms while it runs
 */
export const useTeleop = (rigId: string) =>
  useQuery({
    queryKey: teleopKey(rigId),
    queryFn: () => api.get<TeleopState>(`/rigs/${rigId}/teleop`),
    enabled: (q) => !!q.state.data?.running,
    retry: false,
    refetchInterval: (q) => (q.state.data?.running ? 100 : false),
  })

/** Connects every leader → follower pair (follower torque on). 409: busy or not calibrated, 503: port missing */
export const useStartTeleop = () =>
  useMutation({
    mutationFn: (rigId: string) => api.post<TeleopState>(`/rigs/${rigId}/teleop`),
    onSuccess: (s) => queryClient.setQueryData(teleopKey(s.rigId), s),
  })

/** Stops the loop and disconnects (follower torque off) */
export const useStopTeleop = () =>
  useMutation({
    mutationFn: (rigId: string) => api.delete(`/rigs/${rigId}/teleop`),
    onSuccess: (_, rigId) => {
      queryClient.setQueryData<TeleopState>(teleopKey(rigId), (s) => (s ? { ...s, running: false } : s))
      return queryClient.invalidateQueries({ queryKey: qk.devices })
    },
  })
