// Mock raw MCAP files saved by Capture (one episode per file) plus externally imported MCAP files.
// Our recordings carry task / rig metadata, so the conversion mapping is filled in automatically.

import type { McapTopic, RecordingReview, Recording } from "@/domain/recording"

import type { Outcome } from "@/domain/task"

const pad = (n: number, w = 4) => String(n).padStart(w, "0")

function captureTopics(durationS: number, droppedFrames: number): McapTopic[] {
  return [
    { name: "/so101_leader/action", schema: "vla.robot.JointCommand", kind: "action", rateHz: 60, messages: Math.round(durationS * 60) },
    { name: "/so101_follower/state", schema: "vla.robot.JointState", kind: "state", rateHz: 60, messages: Math.round(durationS * 60) },
    { name: "/cam_top/image", schema: "foxglove.CompressedVideo", kind: "video", rateHz: 30, messages: Math.round(durationS * 30) },
    {
      name: "/cam_wrist/image",
      schema: "foxglove.CompressedVideo",
      kind: "video",
      rateHz: 30,
      messages: Math.round(durationS * 30) - droppedFrames,
    },
    { name: "/labels/subtask", schema: "vla.session.SubtaskEvent", kind: "label", rateHz: null, messages: 4 },
    { name: "/labels/outcome", schema: "vla.session.OutcomeEvent", kind: "label", rateHz: null, messages: 1 },
  ]
}

function captureRecording(
  taskId: string,
  episode: number,
  k: number,
  durationS: number,
  outcome: Outcome,
  review: RecordingReview,
): Recording {
  // Only some non-accepted episodes get frame drops
  const dropped = review !== "accepted" && k % 4 === 2 ? 14 : 0
  const names = ["reach", "grasp", "lift", "place"]
  const done = outcome === "success" ? 4 : outcome === "partial" ? 3 : 2
  const cuts = [0, 0.22, 0.4, 0.65, 1].map((r) => +(r * durationS).toFixed(1))
  const subtasks = names.slice(0, done).map((name, i) => ({ name, startS: cuts[i], endS: cuts[i + 1] }))
  const drops = dropped ? [+(durationS * 0.62).toFixed(1), +(durationS * 0.64).toFixed(1)] : []
  const expectedFrames = Math.round(durationS * 30)
  return {
    id: `${taskId}-${episode}`,
    file: `${taskId}/ep_${pad(episode)}.mcap`,
    source: "capture",
    taskId,
    rigId: "so101-kit",
    episode,
    recordedAt: `2026-${k < 9 ? "09-30" : "10-01"} ${pad(9 + (k % 9), 2)}:${pad((k * 7) % 60, 2)}`,
    durationS,
    sizeMB: +(durationS * 1.9 + k).toFixed(1),
    outcome,
    review,
    topics: captureTopics(durationS, dropped),
    subtasks,
    drops,
    checks: [
      { label: "Action samples", value: `${Math.round(durationS * 60)} / ${Math.round(durationS * 60)}`, ok: true },
      { label: "Video frames", value: `${expectedFrames - dropped} / ${expectedFrames}`, ok: dropped === 0 },
      { label: "Timestamp gap", value: dropped ? "max 71 ms" : "max 34 ms", ok: dropped === 0 },
      { label: "Subtasks", value: `${done} / 4`, ok: done === 4 },
    ],
  }
}

// stack-two-blocks: ep 30–46. older episodes are mostly reviewed, recent ones are pending
const STACK: [number, number, Outcome, RecordingReview][] = Array.from({ length: 17 }, (_, i) => {
  const ep = 30 + i
  const outcome: Outcome = ep % 7 === 3 ? "fail" : ep % 9 === 0 ? "partial" : "success"
  const review: RecordingReview = ep >= 42 ? "pending" : outcome === "fail" ? "rejected" : "accepted"
  return [ep, +(20 + ((ep * 7) % 9) + (ep % 3) * 0.5).toFixed(1), outcome, review]
})

export const RECORDINGS: Recording[] = [
  ...STACK.map(([ep, dur, outcome, review], k) => captureRecording("stack-two-blocks", ep, k, dur, outcome, review)),
  captureRecording("pick-red-cube", 13, 5, 18.2, "success", "accepted"),
  captureRecording("pick-red-cube", 14, 6, 19.0, "fail", "pending"),
  {
    id: "ext-glove-0001",
    file: "imports/glove_session_0001.mcap",
    source: "external",
    recordedAt: "2026-09-29 15:10",
    durationS: 41.3,
    sizeMB: 12.4,
    review: "pending",
    topics: [
      { name: "/glove_r/imu", schema: "sensor_msgs/Imu", kind: "glove", rateHz: 200, messages: 8260 },
      { name: "/glove_r/flex", schema: "std_msgs/Float32MultiArray", kind: "glove", rateHz: 100, messages: 4130 },
      { name: "/glove_r/tactile", schema: "std_msgs/Float32MultiArray", kind: "glove", rateHz: 100, messages: 4130 },
      { name: "/camera/color/image_raw", schema: "sensor_msgs/CompressedImage", kind: "video", rateHz: 30, messages: 1239 },
    ],
    subtasks: [],
    drops: [],
    checks: [
      { label: "Metadata", value: "missing task / rig", ok: false },
      { label: "Video frames", value: "1,239 / 1,239", ok: true },
    ],
  },
  {
    id: "ext-ros2-0003",
    file: "imports/ros2_bag_0003.mcap",
    source: "external",
    recordedAt: "2026-09-28 11:42",
    durationS: 33.0,
    sizeMB: 58.7,
    review: "pending",
    topics: [
      { name: "/joint_states", schema: "sensor_msgs/JointState", kind: "state", rateHz: 50, messages: 1650 },
      { name: "/arm_controller/command", schema: "trajectory_msgs/JointTrajectory", kind: "action", rateHz: 50, messages: 1650 },
      { name: "/camera/image_raw/compressed", schema: "sensor_msgs/CompressedImage", kind: "video", rateHz: 30, messages: 990 },
      { name: "/tf", schema: "tf2_msgs/TFMessage", kind: "other", rateHz: 100, messages: 3300 },
    ],
    subtasks: [],
    drops: [],
    checks: [
      { label: "Metadata", value: "missing task / rig", ok: false },
      { label: "Action samples", value: "1,650 / 1,650", ok: true },
    ],
  },
]
