/** "review" while some episodes are still pending, "reviewed" once all are judged */
export type SessionStatus = "review" | "reviewed"

/** Episodes of one task on one day; id is `<taskId>-<YYYY-MM-DD>` */
export type Session = {
  id: string
  taskId: string
  operator: string | null // pseudonymous ID
  episodes: number
  accepted: number
  successPct: number // 1 decimal
  failPct: number
  status: SessionStatus
  date: string
}
