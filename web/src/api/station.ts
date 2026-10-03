// Station info, dashboard totals, activity, warnings and the current capture task — docs/api/station.md
import { useMutation, useQuery } from "@tanstack/react-query"

import type { DayCount } from "@/domain/activity"
import type { CurrentTask, DataTotal, Station } from "@/domain/station"

import { api } from "./client"
import { qk, queryClient } from "./query"

const currentTaskKey = [...qk.station, "current-task"] as const

export const useStation = () => useQuery({ queryKey: [...qk.station, "info"], queryFn: () => api.get<Station>("/station") })

/** Data collected so far (episodes, frames, hours, storage, success rate), in that order */
export const useDataTotals = () => useQuery({ queryKey: [...qk.station, "totals"], queryFn: () => api.get<DataTotal[]>("/station/totals") })

/** Daily episode counts for the dashboard heatmap: oldest first, starting on a Sunday, ending today */
export const useEpisodeActivity = (weeks = 52) =>
  useQuery({ queryKey: [...qk.station, "activity", weeks], queryFn: () => api.get<DayCount[]>("/station/activity", { weeks }) })

/** Human-readable hardware warnings (low camera fps, hot motor) */
export const useStationWarnings = () =>
  useQuery({ queryKey: [...qk.station, "warnings"], queryFn: () => api.get<string[]>("/station/warnings") })

/** Task currently being captured on this station (null, or `taskId` null, when none) */
export const useCurrentTask = () =>
  useQuery({ queryKey: currentTaskKey, queryFn: () => api.get<CurrentTask | null>("/station/current-task") })

/** Mutation variable: the task id, or null to clear */
export const useSetCurrentTask = () =>
  useMutation({
    mutationFn: (taskId: string | null) => api.put<CurrentTask>("/station/current-task", { taskId }),
    onSuccess: (data) => queryClient.setQueryData(currentTaskKey, data),
  })
