import type { Task } from "@/dummy/tasks"

const ALIGNMENT_YAML: Record<Task["alignment"], string> = {
  chunk: "{ fps: 30, action_chunk: 2 }",
  duplicate: "{ fps: 60, video: duplicate }",
  downsample: "{ fps: 30, action: downsample }",
}

/** Task 정의를 YAML 텍스트로 직렬화 (표시용 간단 serializer) */
export function taskToYaml(t: Task): string {
  const list = (items: string[], indent = "  ") =>
    items.length ? items.map((v) => `\n${indent}- ${v}`).join("") : " []"
  const cameras = t.sensors.filter((s) => s.enabled && s.key !== "glove").map((s) => s.key)
  const glove = t.sensors.find((s) => s.key === "glove")?.enabled ?? false

  return [
    `task_id: ${t.id}`,
    `name: ${t.name}`,
    `instruction: ${t.instruction}`,
    `variants:${list(t.variants)}`,
    `tags: [${t.tags.join(", ")}]`,
    `robot: ${t.robot}`,
    `teleop: ${t.teleop}`,
    `cameras: [${cameras.join(", ")}]`,
    `glove: ${glove}`,
    `rates: { action_hz: ${t.actionHz}, video_fps: ${t.videoFps} }`,
    `episode: { target: ${t.targetEpisodes}, duration_s: ${t.durationS}, reset_s: ${t.resetS}, countdown_s: ${t.countdownS} }`,
    "labels:",
    `  outcome: [${t.outcomes.map((o) => o.value).join(", ")}]`,
    `  subtasks:${t.subtasks.map((s) => `\n    - { key: "${s.key}", name: ${s.name} }`).join("") || " []"}`,
    `  success_criteria: ${t.successCriteria}`,
    "output:",
    `  repo_id: ${t.repoId}`,
    "  format: lerobot_v3",
    `  alignment: ${ALIGNMENT_YAML[t.alignment]}`,
    `  push_to_hub: ${t.pushToHub ? "private" : "false"}`,
  ].join("\n")
}
