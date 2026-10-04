import type { Tone } from "@/components/common/status-dot"
import { ApiError } from "@/api/client"
import type { Rig } from "@/domain/rig"
import { rigDefaults } from "@/domain/rig"
import type { Session } from "@/domain/session"
import type { Task, TaskInput, TaskStatus } from "@/domain/task"
import { taskInput } from "@/domain/task"

export const STATUS: Record<TaskStatus, { tone: Tone; label: string }> = {
  active: { tone: "ok", label: "Active" },
  draft: { tone: "muted", label: "Draft" },
  completed: { tone: "info", label: "Completed" },
}

/** Session count and episode-weighted success rate per task (success is null when there are no episodes) */
export function successByTask(sessions: Session[]) {
  const groups = new Map<string, Session[]>()
  for (const s of sessions) groups.set(s.taskId, [...(groups.get(s.taskId) ?? []), s])
  const out = new Map<string, { sessions: number; success: number | null }>()
  for (const [taskId, list] of groups) {
    const episodes = list.reduce((a, s) => a + s.episodes, 0)
    const success = episodes ? Math.round(list.reduce((a, s) => a + s.successPct * s.episodes, 0) / episodes) : null
    out.set(taskId, { sessions: list.length, success })
  }
  return out
}

/** Turn a list of rates into select options */
export const rateOptions = (xs: number[], unit: string) => xs.map((x) => ({ value: String(x), label: `${x} ${unit}` }))

/** True when the editable fields of two tasks differ */
export const isDirty = (a: Task, b: Task) => JSON.stringify(taskInput(a)) !== JSON.stringify(taskInput(b))

/** Task id rule from the backend: a lowercase slug */
export const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

/** A new draft task with the rig defaults and the usual episode settings */
export function newTaskInput(id: string, name: string, rig: Rig): TaskInput {
  return {
    id,
    name,
    instruction: name,
    variants: [],
    tags: [],
    ...rigDefaults(rig),
    targetEpisodes: 50,
    durationS: 30,
    resetS: 10,
    countdownS: 3,
    outcomes: [
      { value: "success", key: "→" },
      { value: "fail", key: "F" },
      { value: "partial", key: "P" },
    ],
    subtasks: [],
    successCriteria: "",
    repoId: `local/${id.replace(/-/g, "_")}`,
    pushToHub: false,
    status: "draft",
  }
}

/** Readable message for a failed task request: 422 field / line errors are listed after the message */
export function errorText(err: Error | null): string | null {
  if (!err) return null
  if (!(err instanceof ApiError)) return err.message
  const errors = err.details.errors
  if (!Array.isArray(errors) || errors.length === 0) return err.message
  const lines = errors.map((e: { line?: number; loc?: unknown[]; msg?: string }) => {
    const loc = (e.loc ?? []).filter((x) => x !== "body").join(".")
    const where = [e.line && `line ${e.line}`, loc].filter(Boolean).join(" · ")
    return where ? `${where}: ${e.msg}` : String(e.msg)
  })
  return [err.message, ...lines].join("\n")
}
