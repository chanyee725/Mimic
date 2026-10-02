import { getRig } from "@/dummy/rigs"
import type { Task } from "@/dummy/tasks"

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
