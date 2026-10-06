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
  envId: string | null // Isaac Sim environment; null = recorded on the real robot
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
  collected: number // read-only: accepted + pending capture episodes
  version: number // read-only, +1 on every update
  updatedAt: string // read-only, ISO 8601
  updatedBy: string // read-only, pseudonymous operator ID only (never store PII)
}

/** Where a task runs: the real robot, or the Isaac Sim environment in envId */
export type TaskWorld = "real" | "sim"

export const TASK_WORLD_LABEL: Record<TaskWorld, string> = { real: "Real", sim: "Isaac Sim" }

/** Older responses may omit envId */
export const taskWorld = (task: Pick<Task, "envId">): TaskWorld => (task.envId ? "sim" : "real")

/** Body of POST /tasks (create) */
export type TaskInput = Omit<Task, "collected" | "version" | "updatedAt" | "updatedBy">

/** Body of PUT /tasks/{id}: the edited fields plus the version they were based on */
export type TaskUpdate = Omit<TaskInput, "id"> & { id?: string; version: number }

/** Strip the read-only fields of a task, e.g. to start an edit draft */
export function taskInput(task: Task): TaskInput {
  const { collected: _c, version: _v, updatedAt: _a, updatedBy: _b, ...input } = task
  return input
}

/** Progress ring tone for each task status */
export const TASK_RING_TONE = { active: "foreground", completed: "ok", draft: "muted" } as const satisfies Record<TaskStatus, string>
