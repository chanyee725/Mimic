import { EPISODE_ACTIVITY } from "@/dummy/activity"
import { DATA_TOTALS, STATION } from "@/dummy/station"

export const getStation = () => STATION
/** Data collected so far (episodes, frames, hours, storage, success rate) */
export const getDataTotals = () => DATA_TOTALS
/** Daily episode counts for the dashboard heatmap */
export const getEpisodeActivity = () => EPISODE_ACTIVITY
