export type TaskStatus = "active" | "draft" | "completed"

export type Outcome = "success" | "fail" | "partial"

export type Subtask = { key: string; name: string; description: string }

export type Task = {
  id: string
  name: string
  instruction: string
  variants: string[]
  tags: string[]
  rigId: string
  cameras: string[] // rig cameras recorded for this task
  actionHz: number // one of the rig's actionHzOptions
  videoFps: number // one of the rig's videoFpsOptions
  targetEpisodes: number
  durationS: number
  resetS: number
  countdownS: number
  outcomes: { value: Outcome; key: string }[]
  subtasks: Subtask[]
  successCriteria: string
  repoId: string
  pushToHub: boolean
  status: TaskStatus
  collected: number
  version: number
  updatedAt: string
  updatedBy: string // pseudonymous operator ID only (never store PII)
}

/** Progress ring tone for each task status */
export const TASK_RING_TONE = { active: "foreground", completed: "ok", draft: "muted" } as const satisfies Record<TaskStatus, string>
