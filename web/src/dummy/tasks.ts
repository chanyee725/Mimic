import { getRig, rigDefaults } from "@/dummy/rigs"

export type TaskStatus = "active" | "draft" | "completed"
export type Outcome = "success" | "fail" | "partial"
export type Alignment = "chunk" | "duplicate" | "downsample"

export type Subtask = { key: string; name: string; description: string }

export type Task = {
  id: string
  name: string
  instruction: string
  variants: string[]
  tags: string[]
  rigId: string
  cameras: string[] // Rig 카메라 중 이 Task 에서 녹화할 것
  actionHz: number // Rig 의 actionHzOptions 중 선택
  videoFps: number // Rig 의 videoFpsOptions 중 선택
  targetEpisodes: number
  durationS: number
  resetS: number
  countdownS: number
  outcomes: { value: Outcome; key: string }[]
  subtasks: Subtask[]
  successCriteria: string
  repoId: string
  alignment: Alignment
  pushToHub: boolean
  status: TaskStatus
  collected: number
  version: number
  updatedAt: string
  updatedBy: string // 가명 operator ID 만 사용 (PII 저장 금지)
}

const outcomes: Task["outcomes"] = [
  { value: "success", key: "→" },
  { value: "fail", key: "F" },
  { value: "partial", key: "P" },
]

const base = {
  ...rigDefaults(getRig("so101-kit")),
  resetS: 10,
  countdownS: 3,
  outcomes,
  alignment: "chunk" as Alignment,
  pushToHub: true,
}

export const TASKS: Task[] = [
  {
    ...base,
    id: "stack-two-blocks",
    name: "Stack two blocks",
    instruction: "stack the blue block on top of the red block",
    variants: ["put the blue block on the red one", "place blue cube onto red cube"],
    tags: ["pick-place", "tabletop", "single-arm"],
    targetEpisodes: 50,
    durationS: 30,
    subtasks: [
      { key: "1", name: "reach", description: "블록으로 접근" },
      { key: "2", name: "grasp", description: "파란 블록 파지" },
      { key: "3", name: "lift", description: "들어 올리기" },
      { key: "4", name: "place", description: "빨간 블록 위에 놓기" },
    ],
    successCriteria: "파란 블록이 빨간 블록 위에 2초 이상 유지되고, 두 블록 모두 작업 영역 안에 있을 것",
    repoId: "local/stack_two_blocks",
    status: "active",
    collected: 46,
    version: 3,
    updatedAt: "2026-10-01",
    updatedBy: "OP-01",
  },
  {
    ...base,
    id: "pick-red-cube",
    name: "Pick red cube",
    instruction: "pick the red cube and place it in the bowl",
    variants: ["put the red cube into the bowl"],
    tags: ["pick-place", "tabletop"],
    targetEpisodes: 50,
    durationS: 20,
    subtasks: [
      { key: "1", name: "reach", description: "큐브로 접근" },
      { key: "2", name: "grasp", description: "큐브 파지" },
      { key: "3", name: "place", description: "그릇에 놓기" },
    ],
    successCriteria: "빨간 큐브가 그릇 안에 있을 것",
    repoId: "local/pick_red_cube",
    status: "active",
    collected: 14,
    version: 1,
    updatedAt: "2026-10-02",
    updatedBy: "OP-03",
  },
  {
    ...base,
    id: "open-drawer",
    name: "Open drawer",
    instruction: "open the top drawer",
    variants: ["pull the top drawer open"],
    tags: ["articulated"],
    targetEpisodes: 40,
    durationS: 25,
    subtasks: [
      { key: "1", name: "reach", description: "손잡이로 접근" },
      { key: "2", name: "grasp", description: "손잡이 파지" },
      { key: "3", name: "pull", description: "당겨서 열기" },
    ],
    successCriteria: "서랍이 10cm 이상 열려 있을 것",
    repoId: "local/open_drawer",
    status: "completed",
    collected: 40,
    version: 2,
    updatedAt: "2026-09-30",
    updatedBy: "OP-03",
  },
  {
    ...base,
    id: "sort-by-color",
    name: "Sort by color",
    instruction: "sort the blocks into matching color trays",
    variants: [],
    tags: ["sorting", "multi-step"],
    cameras: ["top", "wrist"],
    targetEpisodes: 100,
    durationS: 45,
    subtasks: [
      { key: "1", name: "pick", description: "블록 집기" },
      { key: "2", name: "place", description: "같은 색 트레이에 놓기" },
    ],
    successCriteria: "모든 블록이 같은 색 트레이에 있을 것",
    repoId: "local/sort_by_color",
    status: "draft",
    collected: 0,
    version: 1,
    updatedAt: "2026-10-02",
    updatedBy: "OP-02",
  },
  {
    ...base,
    id: "pour-into-cup",
    name: "Pour into cup",
    instruction: "pour the beads from the small cup into the large cup",
    variants: ["empty the small cup into the large one"],
    tags: ["pouring", "tabletop"],
    targetEpisodes: 60,
    durationS: 35,
    subtasks: [
      { key: "1", name: "grasp", description: "작은 컵 파지" },
      { key: "2", name: "pour", description: "기울여 붓기" },
      { key: "3", name: "place", description: "컵 내려놓기" },
    ],
    successCriteria: "구슬의 90% 이상이 큰 컵 안에 있을 것",
    repoId: "local/pour_into_cup",
    status: "active",
    collected: 22,
    version: 1,
    updatedAt: "2026-09-29",
    updatedBy: "OP-02",
  },
  {
    ...base,
    id: "wipe-table",
    name: "Wipe table",
    instruction: "wipe the spill with the sponge",
    variants: [],
    tags: ["contact-rich"],
    targetEpisodes: 30,
    durationS: 40,
    subtasks: [
      { key: "1", name: "grasp", description: "스펀지 파지" },
      { key: "2", name: "wipe", description: "얼룩 닦기" },
    ],
    successCriteria: "얼룩이 남아 있지 않을 것",
    repoId: "local/wipe_table",
    status: "draft",
    collected: 0,
    version: 1,
    updatedAt: "2026-10-02",
    updatedBy: "OP-01",
  },
]

export const getTask = (id: string) => TASKS.find((t) => t.id === id)
