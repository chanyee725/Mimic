export type Station = { id: string; robot: string; date: string } // robot = rig name // date = station's today (YYYY-MM-DD)

export type DataTotalKey = "episodes" | "frames" | "hours" | "storage" | "success"

/** One headline number on the dashboard (value is pre-formatted by the backend) */
export type DataTotal = { key: DataTotalKey; label: string; value: string }

/** Task currently being captured on this station (null once it is cleared or the task is deleted) */
export type CurrentTask = { taskId: string | null }
