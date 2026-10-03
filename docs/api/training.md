# Training

SmolVLA training jobs on the local GPU or a rented RunPod GPU, their per-step metrics, checkpoints and pods.
Web: `api/training.ts`, `features/training/lib/*` (params, run, runpod).

## Types

```ts
JobStatus = "running" | "queued" | "done" | "failed" | "stopped"
Compute   = "local" | "runpod"
PodState  = { state: "running" | "idle" | "terminated"; autoTerminate: boolean; since?: string; idleForS?: number }
Checkpoint = { step: number; savedAt: string; sizeMB: number }

TrainJob = {
  id: string; policy: string; dataset: string; taskId: string
  compute: Compute; gpu: string
  pod?: string; pricePerHr?: number; podState?: PodState        // runpod only
  status: JobStatus
  step: number; total: number; batch: number; epoch: number; epochs: number
  startedAt?: string; elapsedS?: number; etaS?: number; stepsPerS?: number
  costUsd?: number                                                // runpod: so far
  overrides: Record<string, number | boolean | string>            // lerobot-train flags that differ from defaults
  checkpoints: Checkpoint[]
  error?: string
}

RunPodGpu = { name: string; vramGB: number; pricePerHr: number; community: boolean; stock: "high" | "low" | "none" }
RunPodOptions = { cloud: "secure" | "community"; pricing: "on-demand" | "spot"; gpuCount: 1 | 2 | 4;
                  maxHours: number; budget: number; diskGB: number; volume: string; region: string;
                  terminateOnFinish: boolean; pushToHub: boolean }

TrainingConfig = {
  policy: string; policyBase: string
  localGpus: { id: string; name: string; vram: string; busyBy?: string }[]
  runpod: { gpus: RunPodGpu[]; regions: string[]; volumes: { id: string; label: string; note: string }[];
            priceFactor: { cloud: { secure: number; community: number }; pricing: { "on-demand": number; spot: number } };
            defaults: RunPodOptions }
  paramGroups: { title: string; params: { key: string; label: string; default: number | boolean | string; hint?: string }[] }[]
  trainableDatasets: string[]          // LeRobot datasets with status ready
}

MetricSeries = "loss_raw" | "loss" | "grad_norm" | "lr" | "update_s" | "data_s" | "gpu_util" | "gpu_mem"
Metrics = { fromStep: number; toStep: number; every: number; series: Record<MetricSeries, number[]> }
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/training/config` | | `TrainingConfig` | `LOCAL_GPUS`, `RUNPOD_*`, `POLICY*`, `PARAM_GROUPS`, `trainableDatasets()` |
| GET | `/training/jobs?status=` | | `TrainJob[]` newest first | `listJobs()` |
| GET | `/training/jobs/{id}` | | `TrainJob` | `getJob(id)` |
| POST | `/training/jobs` | `{ dataset, compute, gpu, overrides, runpod?: RunPodOptions }` | `202 TrainJob` (running, or queued when the local GPU is busy); 422 unknown override key; 424 RunPod key missing | Start / Queue training (after confirm dialog) |
| POST | `/training/jobs/{id}/stop` | | `TrainJob` (stopped; saves a last checkpoint); 409 if not active | Stop training / Cancel |
| POST | `/training/jobs/{id}/pod/terminate` | | `TrainJob` (podState terminated); 409 if no pod, already terminated or the job is still active | Terminate now |
| GET | `/training/jobs/{id}/metrics?fromStep=0&maxPoints=2000` | | `Metrics` — averaged into at most `maxPoints` buckets | Metrics plots (history) |
| GET | `/training/jobs/{id}/command` | | `{ command: string }` — the exact `lerobot-train` command line | Confirm dialog / params preview |
| POST | `/training/command-preview` | same body as POST `/training/jobs` | `{ command, ratePerHr?, capHours?, maxCostUsd? }` | Confirm dialog |
| GET | `/training/jobs/{id}/checkpoints/{step}/download` | | `application/zip` (501 until storage lands) | Download |
| POST | `/training/jobs/{id}/checkpoints/{step}/push` | `{ repo?: string }` | `202 { repo }` (default `<hf namespace>/smolvla_<task>`); 424 HF token missing | Push to HF Hub |
| POST | `/training/jobs/{id}/checkpoints/{step}/save` | `{ name }` | `201 Model` (id `m-<jobId>-<step:06>`); 409 if already saved | Save to Models |

Rules:

- `POST /training/jobs` / `command-preview` validate: `dataset` ∈ `trainableDatasets`; `gpu` is a local GPU id or name, or a
  RunPod GPU name (stock `none` → 409; non-community GPU on the community cloud → 422); `runpod.region` / `runpod.volume` exist;
  every `overrides` key is in `paramGroups` and matches the default's type (bool / integer ≥ 0, `steps` · `batch_size` ·
  `save_freq` · `log_freq` ≥ 1 / numeric string). Field errors come back as 422 with `details.errors[].loc`.
- `runpod` defaults to `runpod.defaults` when omitted. A RunPod job's `pricePerHr` is the rate with the options applied
  (`base × gpuCount × priceFactor.cloud × priceFactor.pricing`).
- Preview: `capHours` = `min(maxHours, budget / rate)` when a budget is set, else `maxHours`; omitted when there is no limit.
- Stop: a running job saves a last checkpoint at the current step; a running pod is terminated (`autoTerminate`) or goes idle.
  Stopping the running local job starts the oldest queued local job on that GPU.
- Command: `--policy.device=cuda` is always added; `steps` / `batch_size` come from the job, other flags only when they differ
  from the defaults.

Live: `training.updated` (status, step, eta, cost, pod state, new checkpoint) and `training.metrics` (one sample per step) events.

## Changes from the web mocks

`elapsed` / `eta` strings → `elapsedS` / `etaS`; `podState.idleFor` → `idleForS`; RunPod config and lerobot params move
from frontend constants to `/training/config`.
