// Mock saved models: checkpoints picked from jobs (one lerobot checkpoint folder = one model).
// For real: scan the models folder and check uploads through the HF Hub API.

import type { Model } from "@/domain/model"

const dir = (task: string, job: string, step: number) => `~/vla/models/${task}/${job}-${String(step).padStart(6, "0")}`

export const MODELS: Model[] = [
  {
    id: "m-open-drawer-20k",
    name: "open-drawer v2",
    taskId: "open-drawer",
    dataset: "local/open_drawer",
    jobId: "job_035",
    step: 20000,
    loss: 0.061,
    sizeMB: 1850,
    savedAt: "2026-10-01 23:12",
    localPath: dir("open-drawer", "job_035", 20000),
    hubRepo: "vla-lab/smolvla_open_drawer",
    evals: [
      { at: "2026-10-02 10:30", trials: 10, success: 8, instruction: "open the top drawer" },
      { at: "2026-10-02 11:05", trials: 5, success: 2, instruction: "open the bottom drawer" },
    ],
  },
  {
    id: "m-open-drawer-15k",
    name: "open-drawer v2 (15k)",
    taskId: "open-drawer",
    dataset: "local/open_drawer",
    jobId: "job_035",
    step: 15000,
    loss: 0.074,
    sizeMB: 1850,
    savedAt: "2026-10-01 22:05",
    localPath: dir("open-drawer", "job_035", 15000),
    evals: [{ at: "2026-10-02 10:10", trials: 10, success: 6, instruction: "open the top drawer" }],
  },
  {
    id: "m-stack-20k",
    name: "stack-two-blocks v1",
    taskId: "stack-two-blocks",
    dataset: "local/stack_two_blocks",
    jobId: "job_033",
    step: 20000,
    loss: 0.066,
    sizeMB: 1850,
    savedAt: "2026-09-30 21:39",
    localPath: dir("stack-two-blocks", "job_033", 20000),
    evals: [{ at: "2026-10-01 09:40", trials: 12, success: 7, instruction: "stack the blue block on top of the red block" }],
  },
  {
    id: "m-stack-10k",
    name: "stack-two-blocks v2 (10k, in training)",
    taskId: "stack-two-blocks",
    dataset: "local/stack_two_blocks",
    jobId: "job_036",
    step: 10000,
    loss: 0.088,
    sizeMB: 1850,
    savedAt: "2026-10-02 10:24",
    localPath: dir("stack-two-blocks", "job_036", 10000),
    evals: [],
  },
]

export const getModel = (id: string) => MODELS.find((m) => m.id === id)

/** Layout of a lerobot checkpoint folder */
export const MODEL_FILES = [
  { path: "pretrained_model/model.safetensors", sizeMB: 1790 },
  { path: "pretrained_model/config.json", sizeMB: 0.01 },
  { path: "pretrained_model/train_config.json", sizeMB: 0.01 },
  { path: "training_state/optimizer_state.safetensors", sizeMB: 58 },
  { path: "training_state/training_step.json", sizeMB: 0.01 },
]
