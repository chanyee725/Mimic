// 학습 Job 더미. 모델은 SmolVLA 하나만 쓴다.
// Job 은 이 스테이션의 로컬 GPU 또는 RunPod 에서 빌린 GPU 에서 돈다.

export type JobStatus = "running" | "queued" | "done" | "failed" | "stopped"
export type Compute = "local" | "runpod"

export type Checkpoint = { step: number; savedAt: string; sizeMB: number }

export type TrainJob = {
  id: string
  policy: string
  dataset: string
  taskId: string
  compute: Compute
  gpu: string
  pod?: string // RunPod pod 이름 (runpod 만)
  pricePerHr?: number // RunPod 시간당 요금 (USD)
  status: JobStatus
  step: number
  total: number
  batch: number
  epoch: number
  epochs: number
  startedAt?: string
  elapsed?: string // 학습 경과 시간
  eta?: string
  checkpoints: Checkpoint[]
  error?: string
}

export const POLICY = "SmolVLA"
export const POLICY_BASE = "lerobot/smolvla_base"

/** 이 스테이션에 꽂힌 GPU */
export const LOCAL_GPUS = [{ id: "cuda:0", name: "RTX 4090", vram: "24 GB" }]

/** RunPod 에서 빌릴 수 있는 GPU. 요금은 예시 값 */
export const RUNPOD_GPUS = [
  { name: "RTX 4090", vram: "24 GB", pricePerHr: 0.69 },
  { name: "A100", vram: "80 GB", pricePerHr: 1.89 },
  { name: "H100", vram: "80 GB", pricePerHr: 2.99 },
]

export type RunPodOptions = {
  cloud: "secure" | "community"
  pricing: "on-demand" | "spot"
  gpuCount: 1 | 2 | 4
  /** 이 시간이 지나면 학습을 멈추고 pod 를 끈다 */
  maxHours: number
  /** 누적 비용이 넘으면 멈춘다 (USD, 0 = 제한 없음) */
  budget: number
  diskGB: number
  volume: string
  region: string
  terminateOnFinish: boolean
  pushToHub: boolean
}

export const RUNPOD_DEFAULTS: RunPodOptions = {
  cloud: "secure",
  pricing: "on-demand",
  gpuCount: 1,
  maxHours: 6,
  budget: 0,
  diskGB: 50,
  volume: "none",
  region: "any",
  terminateOnFinish: true,
  pushToHub: false,
}

/** 요금 배율 (예시). Community 는 개인 호스트, Spot 은 중간에 회수될 수 있다 */
export const RUNPOD_PRICE_FACTOR = { cloud: { secure: 1, community: 0.8 }, pricing: { "on-demand": 1, spot: 0.5 } }

export const RUNPOD_VOLUMES = [
  { id: "none", label: "None", note: "pod 를 끄면 데이터가 지워집니다" },
  { id: "vla-datasets", label: "vla-datasets (200 GB, EU-RO-1)", note: "데이터셋 캐시 + checkpoint 보관" },
]

export const RUNPOD_REGIONS = ["any", "EU-RO-1", "EU-SE-1", "US-TX-3", "US-CA-2"]

const ckpts = (steps: number[], day: string, sizeMB = 1850): Checkpoint[] =>
  steps.map((step, i) => ({ step, savedAt: `${day} ${String(9 + i).padStart(2, "0")}:${String((i * 23) % 60).padStart(2, "0")}`, sizeMB }))

export const JOBS: TrainJob[] = [
  {
    id: "job_036",
    policy: POLICY,
    dataset: "local/stack_two_blocks",
    taskId: "stack-two-blocks",
    compute: "runpod",
    gpu: "A100 80GB",
    pod: "pod-a100-01",
    pricePerHr: 1.89,
    status: "running",
    step: 12800,
    total: 20000,
    batch: 64,
    epoch: 19,
    epochs: 30,
    startedAt: "2026-10-02 12:10",
    elapsed: "2h 08m",
    eta: "1h 12m",
    checkpoints: ckpts([5000, 10000], "2026-10-02"),
  },
  {
    id: "job_037",
    policy: POLICY,
    dataset: "local/open_drawer",
    taskId: "open-drawer",
    compute: "local",
    gpu: "RTX 4090",
    status: "running",
    step: 4100,
    total: 20000,
    batch: 32,
    epoch: 6,
    epochs: 30,
    startedAt: "2026-10-02 13:20",
    elapsed: "58m",
    eta: "3h 45m",
    checkpoints: [],
  },
  {
    id: "job_038",
    policy: POLICY,
    dataset: "local/stack_two_blocks",
    taskId: "stack-two-blocks",
    compute: "runpod",
    gpu: "H100 80GB",
    pricePerHr: 2.99,
    status: "queued",
    step: 0,
    total: 40000,
    batch: 64,
    epoch: 0,
    epochs: 60,
    checkpoints: [],
  },
  {
    id: "job_035",
    policy: POLICY,
    dataset: "local/open_drawer",
    taskId: "open-drawer",
    compute: "runpod",
    gpu: "RTX 4090",
    pod: "pod-4090-02",
    pricePerHr: 0.69,
    status: "done",
    step: 20000,
    total: 20000,
    batch: 32,
    epoch: 30,
    epochs: 30,
    startedAt: "2026-10-01 18:40",
    elapsed: "4h 31m",
    checkpoints: ckpts([5000, 10000, 15000, 20000], "2026-10-01"),
  },
  {
    id: "job_034",
    policy: POLICY,
    dataset: "local/stack_two_blocks",
    taskId: "stack-two-blocks",
    compute: "local",
    gpu: "RTX 4090",
    status: "failed",
    step: 2600,
    total: 20000,
    batch: 64,
    epoch: 4,
    epochs: 30,
    startedAt: "2026-10-01 10:05",
    elapsed: "21m",
    checkpoints: [],
    error: "CUDA out of memory at batch 64. Lower the batch size or use a GPU with more memory.",
  },
]

export const getJob = (id: string) => JOBS.find((j) => j.id === id)

export const isActive = (j: TrainJob) => j.status === "running" || j.status === "queued"
