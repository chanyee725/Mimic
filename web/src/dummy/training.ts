// Mock training jobs. SmolVLA is the only model.
// Jobs run on this station's local GPU or on a GPU rented from RunPod.

import type { Checkpoint, TrainJob, RunPodGpu, RunPodOptions } from "@/domain/training"

export const POLICY = "SmolVLA"
export const POLICY_BASE = "lerobot/smolvla_base"

/** GPUs installed in this station */
export const LOCAL_GPUS = [{ id: "cuda:0", name: "RTX 4090", vram: "24 GB" }]

/** NVIDIA GPUs rentable on RunPod (lerobot targets CUDA). Prices and stock are example values */
export const RUNPOD_GPUS: RunPodGpu[] = [
  { name: "RTX A4000", vramGB: 16, pricePerHr: 0.25, community: true, stock: "high" },
  { name: "RTX A4500", vramGB: 20, pricePerHr: 0.34, community: true, stock: "high" },
  { name: "RTX 3090", vramGB: 24, pricePerHr: 0.43, community: true, stock: "high" },
  { name: "RTX A5000", vramGB: 24, pricePerHr: 0.36, community: true, stock: "high" },
  { name: "L4", vramGB: 24, pricePerHr: 0.43, community: false, stock: "low" },
  { name: "RTX 4090", vramGB: 24, pricePerHr: 0.69, community: true, stock: "high" },
  { name: "RTX 5090", vramGB: 32, pricePerHr: 0.94, community: true, stock: "low" },
  { name: "A40", vramGB: 48, pricePerHr: 0.44, community: false, stock: "high" },
  { name: "RTX A6000", vramGB: 48, pricePerHr: 0.76, community: true, stock: "high" },
  { name: "RTX 6000 Ada", vramGB: 48, pricePerHr: 0.77, community: true, stock: "low" },
  { name: "L40S", vramGB: 48, pricePerHr: 0.86, community: true, stock: "high" },
  { name: "L40", vramGB: 48, pricePerHr: 0.99, community: false, stock: "low" },
  { name: "A100 PCIe", vramGB: 80, pricePerHr: 1.64, community: true, stock: "low" },
  { name: "A100 SXM", vramGB: 80, pricePerHr: 1.89, community: false, stock: "high" },
  { name: "H100 PCIe", vramGB: 80, pricePerHr: 2.39, community: true, stock: "low" },
  { name: "H100 SXM", vramGB: 80, pricePerHr: 2.99, community: false, stock: "high" },
  { name: "H100 NVL", vramGB: 94, pricePerHr: 2.79, community: false, stock: "low" },
  { name: "H200 SXM", vramGB: 141, pricePerHr: 3.99, community: false, stock: "low" },
  { name: "B200", vramGB: 180, pricePerHr: 5.99, community: false, stock: "none" },
]

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

/** Price multipliers (examples). Community = individual hosts; Spot can be reclaimed mid-run */
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
    podState: { state: "running", autoTerminate: true },
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
    // Auto-terminate is off, so the pod is still up after training
    podState: { state: "idle", autoTerminate: false, since: "2026-10-01 23:11", idleFor: "15h 49m" },
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
    id: "job_033",
    policy: POLICY,
    dataset: "local/stack_two_blocks",
    taskId: "stack-two-blocks",
    compute: "runpod",
    gpu: "A100 80GB",
    pod: "pod-a100-02",
    pricePerHr: 1.89,
    podState: { state: "terminated", autoTerminate: true, since: "2026-09-30 21:40" },
    status: "done",
    step: 20000,
    total: 20000,
    batch: 64,
    epoch: 30,
    epochs: 30,
    startedAt: "2026-09-30 18:02",
    elapsed: "3h 36m",
    checkpoints: ckpts([5000, 10000, 15000, 20000], "2026-09-30"),
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
