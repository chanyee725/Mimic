export type Station = { id: string; robot: string; date: string }

export type DataTotalKey = "episodes" | "frames" | "hours" | "storage" | "success"

/** One headline number on the dashboard (value is pre-formatted by the backend) */
export type DataTotal = { key: DataTotalKey; label: string; value: string }
