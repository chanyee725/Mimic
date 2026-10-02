import type { Tone } from "@/components/common/status-dot"
import { getRig } from "@/api/rigs"
import { listSessions } from "@/api/sessions"
import type { Task, TaskStatus } from "@/domain/task"

export const STATUS: Record<TaskStatus, { tone: Tone; label: string }> = {
  active: { tone: "ok", label: "Active" },
  draft: { tone: "muted", label: "Draft" },
  completed: { tone: "info", label: "Completed" },
}

/** Session count and episode-weighted success rate for a task (null when there are no episodes) */
export function successOf(taskId: string) {
  const sessions = listSessions().filter((s) => s.taskId === taskId)
  const episodes = sessions.reduce((a, s) => a + s.episodes, 0)
  const success = episodes ? Math.round(sessions.reduce((a, s) => a + s.successPct * s.episodes, 0) / episodes) : null
  return { sessions: sessions.length, success }
}

/** Turn a list of rates into select options */
export const rateOptions = (xs: number[], unit: string) => xs.map((x) => ({ value: String(x), label: `${x} ${unit}` }))

/** Serialize a task definition to YAML text (simple display-only serializer) */
export function taskToYaml(t: Task): string {
  const rig = getRig(t.rigId)

  return [
    `task_id: ${t.id}`,
    `name: ${t.name}`,
    `label: ${t.instruction}`,
    `tags: [${t.tags.join(", ")}]`,
    `rig: ${rig.id}  # ${rig.master} → ${rig.slave}, ${rig.joints.length} DoF`,
    `cameras: [${t.cameras.join(", ")}]`,
    `rates: { action_hz: ${t.actionHz}, video_fps: ${t.videoFps} }`,
    `episode: { target: ${t.targetEpisodes}, duration_s: ${t.durationS}, reset_s: ${t.resetS}, countdown_s: ${t.countdownS} }`,
    "output:",
    `  repo_id: ${t.repoId}`,
    "  format: lerobot_v3",
    `  fps: ${t.videoFps}  # action ${t.actionHz} Hz → ${t.videoFps} Hz`,
    `  push_to_hub: ${t.pushToHub ? "private" : "false"}`,
  ].join("\n")
}
