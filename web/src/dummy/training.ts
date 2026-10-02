export type JobStatus = "running" | "done" | "queued" | "failed"

export type TrainJob = {
  id: string
  policy: string
  dataset: string
  gpu: string
  step: number
  total: number
  status: JobStatus
  eta?: string
  pod?: string // RunPod pod 이름
  taskId?: string
  elapsed?: string // 학습 경과 시간
  epoch?: number
  epochs?: number
}

export const JOBS: TrainJob[] = [
  { id: "job_031", policy: "ACT", dataset: "local/stack_two_blocks", gpu: "A100 80GB", step: 64000, total: 100000, status: "running", eta: "1h 12m", pod: "pod-a100-01", taskId: "stack-two-blocks", elapsed: "2h 08m", epoch: 64, epochs: 100 },
  { id: "job_033", policy: "SmolVLA", dataset: "local/pick_red_cube", gpu: "RTX 4090", step: 8200, total: 20000, status: "running", eta: "2h 40m", pod: "pod-4090-02", taskId: "pick-red-cube", elapsed: "1h 51m", epoch: 12, epochs: 30 },
  { id: "job_034", policy: "Diffusion Policy", dataset: "local/open_drawer", gpu: "A100 80GB", step: 31000, total: 80000, status: "running", eta: "3h 05m", pod: "pod-a100-03", taskId: "open-drawer", elapsed: "1h 56m", epoch: 31, epochs: 80 },
  { id: "job_030", policy: "SmolVLA", dataset: "local/open_drawer", gpu: "RTX 4090", step: 20000, total: 20000, status: "done" },
  { id: "job_032", policy: "pi0", dataset: "local/stack_two_blocks", gpu: "H100", step: 0, total: 30000, status: "queued" },
]

export const CHECKPOINTS = [
  { name: "job_031/checkpoints/060000", meta: "2026-10-02 09:40 · 207 MB" },
  { name: "job_031/checkpoints/040000", meta: "2026-10-02 08:55 · 207 MB" },
  { name: "job_030/checkpoints/last", meta: "2026-10-01 22:10 · 1.8 GB" },
]

export const POLICIES = ["ACT", "Diffusion Policy", "SmolVLA", "pi0 / pi0.5"]
export const DATASETS = ["local/stack_two_blocks", "local/open_drawer"]
export const GPUS = [
  { name: "RTX 4090", vram: "24 GB" },
  { name: "A100", vram: "80 GB" },
  { name: "H100", vram: "80 GB" },
]

export type LossPoint = { step: number; train: number; val: number }

/** loss 곡선 더미. decay 가 클수록 천천히 수렴, points 는 1k step 간격 개수 */
export function lossCurve(decay = 14, points = 65): LossPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    step: i * 1000,
    train: 0.08 + 0.9 * Math.exp(-i / decay) + Math.sin(i * 1.9) * 0.02,
    val: 0.13 + 0.9 * Math.exp(-i / (decay + 3)) + Math.sin(i * 1.3) * 0.01,
  }))
}

export const LOSS_CURVE = lossCurve()

