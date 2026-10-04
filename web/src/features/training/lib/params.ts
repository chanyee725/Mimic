import type { Param, ParamValue, RunPodOptions } from "@/domain/training"

// lerobot-train parameters. key is the CLI flag name as is (--key=value); groups and defaults come from /training/config.

export type Overrides = Record<string, ParamValue>

/** Overrides that differ from the defaults */
export function changedOverrides(o: Overrides, params: Param[]): Overrides {
  return Object.fromEntries(params.filter((p) => p.key in o && o[p.key] !== p.default).map((p) => [p.key, o[p.key]]))
}

/** CLI flags for values that differ from the defaults */
export function overrideFlags(o: Overrides, params: Param[]) {
  return Object.entries(changedOverrides(o, params)).map(([k, v]) => `--${k}=${v}`)
}

/** lerobot-train command for display (one flag per line) */
export function trainCommand(policyBase: string, dataset: string, flags: string[]) {
  return ["lerobot-train", `--policy.path=${policyBase}`, `--dataset.repo_id=${dataset}`, ...flags].join(" \\\n  ")
}

/** Values passed to the confirm dialog before training starts */
export type TrainingPlan = {
  dataset: string
  compute: "local" | "runpod"
  gpu: string
  /** Job id holding the local GPU, if busy (the new job is queued) */
  queuedBehind?: string
  runpod?: RunPodOptions
  /** Changed lerobot-train values only */
  overrides: Overrides
}
