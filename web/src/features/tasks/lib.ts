import type { Tone } from "@/components/app/status-dot"
import { getRig } from "@/dummy/rigs"
import { SESSIONS } from "@/dummy/sessions"
import type { Task, TaskStatus } from "@/dummy/tasks"

export const STATUS: Record<TaskStatus, { tone: Tone; label: string }> = {
  active: { tone: "ok", label: "Active" },
  draft: { tone: "muted", label: "Draft" },
  completed: { tone: "info", label: "Completed" },
}

/** Task 에 묶인 세션 수와 에피소드 가중 평균 성공률 (에피소드가 없으면 null) */
export function successOf(taskId: string) {
  const sessions = SESSIONS.filter((s) => s.taskId === taskId)
  const episodes = sessions.reduce((a, s) => a + s.episodes, 0)
  const success = episodes ? Math.round(sessions.reduce((a, s) => a + s.successPct * s.episodes, 0) / episodes) : null
  return { sessions: sessions.length, success }
}

/** 주기 목록을 선택 상자 옵션으로 */
export const rateOptions = (xs: number[], unit: string) => xs.map((x) => ({ value: String(x), label: `${x} ${unit}` }))

/** Task 정의를 YAML 텍스트로 직렬화 (표시용 간단 serializer) */
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
