export type SessionStatus = "recording" | "review" | "converted"

export type Session = {
  id: string
  taskId: string
  operator: string // pseudonymous ID
  episodes: number
  accepted: number
  successPct: number
  failPct: number
  status: SessionStatus
  date: string
}
