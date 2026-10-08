/** What one day recorded for one task */
export type DayTask = { taskId: string | null; name: string; count: number; success: number; fail: number; seconds: number }

/** Episodes recorded on one day (YYYY-MM-DD); the activity list starts on a Sunday and ends today */
export type DayCount = { date: string; count: number; seconds: number; tasks: DayTask[] }
