import { POLICY_BASE, type RunPodOptions } from "@/dummy/training"

// lerobot-train parameters. key is the CLI flag name as is (--key=value).
// Defaults follow lerobot TrainPipelineConfig / SmolVLAConfig; verify them against the pinned lerobot version.

export type ParamValue = number | boolean | string

export type Param = {
  key: string
  label: string
  default: ParamValue
  hint?: string
}

type ParamGroup = { title: string; params: Param[] }

export const PARAM_GROUPS: ParamGroup[] = [
  {
    title: "Training",
    params: [
      { key: "steps", label: "Steps", default: 100000 },
      { key: "batch_size", label: "Batch size", default: 8, hint: "줄이면 GPU 메모리를 덜 씁니다" },
      { key: "seed", label: "Seed", default: 1000 },
      { key: "num_workers", label: "Data loader workers", default: 4 },
    ],
  },
  {
    title: "Optimizer",
    params: [
      { key: "policy.optimizer_lr", label: "Learning rate", default: "1e-4" },
      { key: "policy.optimizer_weight_decay", label: "Weight decay", default: "1e-10" },
      { key: "policy.optimizer_grad_clip_norm", label: "Grad clip norm", default: 10 },
    ],
  },
  {
    title: "Scheduler",
    params: [
      { key: "policy.scheduler_warmup_steps", label: "Warmup steps", default: 1000 },
      { key: "policy.scheduler_decay_steps", label: "Decay steps", default: 30000 },
      { key: "policy.scheduler_decay_lr", label: "Final learning rate", default: "2.5e-6" },
    ],
  },
  {
    title: "Policy",
    params: [
      { key: "policy.chunk_size", label: "Action chunk size", default: 50 },
      { key: "policy.n_action_steps", label: "Action steps per inference", default: 50 },
      { key: "policy.freeze_vision_encoder", label: "Freeze vision encoder", default: true },
      { key: "policy.train_expert_only", label: "Train action expert only", default: true },
      { key: "policy.use_amp", label: "Mixed precision (AMP)", default: false },
    ],
  },
  {
    title: "Checkpoints and logging",
    params: [
      { key: "save_freq", label: "Save every (steps)", default: 20000 },
      { key: "log_freq", label: "Log every (steps)", default: 200 },
      { key: "wandb.enable", label: "Log to Weights & Biases", default: false },
    ],
  },
]

const ALL_PARAMS = PARAM_GROUPS.flatMap((g) => g.params)

export type Overrides = Record<string, ParamValue>

/** CLI flags for values that differ from the defaults */
export function overrideFlags(o: Overrides) {
  return ALL_PARAMS.filter((p) => p.key in o && o[p.key] !== p.default).map((p) => `--${p.key}=${o[p.key]}`)
}

/** lerobot-train command for display (one flag per line) */
export function trainCommand(dataset: string, flags: string[]) {
  return ["lerobot-train", `--policy.path=${POLICY_BASE}`, `--dataset.repo_id=${dataset}`, ...flags].join(" \\\n  ")
}

/** Values passed to the confirm dialog before training starts */
export type TrainingPlan = {
  dataset: string
  compute: "local" | "runpod"
  gpu: string
  /** Job id holding the local GPU, if busy (the new job is queued) */
  queuedBehind?: string
  runpod?: { options: RunPodOptions; rate: number; capHours: number }
  flags: string[]
}
