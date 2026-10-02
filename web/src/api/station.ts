import { EPISODE_ACTIVITY } from "@/dummy/activity"
import { DATA_TOTALS, STATION } from "@/dummy/station"
import type { DayCount } from "@/domain/activity"
import type { DataTotal, Station } from "@/domain/station"

export const getStation = (): Station => STATION
/** Data collected so far (episodes, frames, hours, storage, success rate) */
export const getDataTotals = (): DataTotal[] => DATA_TOTALS
/** Daily episode counts for the dashboard heatmap */
export const getEpisodeActivity = (): DayCount[] => EPISODE_ACTIVITY
