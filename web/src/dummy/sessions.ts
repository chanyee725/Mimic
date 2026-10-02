export type SessionStatus = "recording" | "review" | "converted"

export type Session = {
  id: string
  taskId: string
  operator: string // 가명 ID
  episodes: number
  accepted: number
  successPct: number
  failPct: number
  status: SessionStatus
  date: string
}

export const SESSIONS: Session[] = [
  {
    id: "ses_0013",
    taskId: "stack-two-blocks",
    operator: "OP-02",
    episodes: 12,
    accepted: 10,
    successPct: 75,
    failPct: 8,
    status: "recording",
    date: "2026-10-02",
  },
  {
    id: "ses_0012",
    taskId: "pick-red-cube",
    operator: "OP-03",
    episodes: 14,
    accepted: 12,
    successPct: 79,
    failPct: 14,
    status: "recording",
    date: "2026-10-02",
  },
  {
    id: "ses_0011",
    taskId: "stack-two-blocks",
    operator: "OP-01",
    episodes: 50,
    accepted: 46,
    successPct: 84,
    failPct: 8,
    status: "review",
    date: "2026-10-01",
  },
  {
    id: "ses_0010",
    taskId: "open-drawer",
    operator: "OP-03",
    episodes: 40,
    accepted: 38,
    successPct: 90,
    failPct: 5,
    status: "converted",
    date: "2026-09-30",
  },
  {
    id: "ses_0009",
    taskId: "pour-into-cup",
    operator: "OP-02",
    episodes: 24,
    accepted: 22,
    successPct: 71,
    failPct: 17,
    status: "review",
    date: "2026-09-29",
  },
  {
    id: "ses_0008",
    taskId: "stack-two-blocks",
    operator: "OP-01",
    episodes: 20,
    accepted: 15,
    successPct: 75,
    failPct: 25,
    status: "converted",
    date: "2026-09-27",
  },
]
