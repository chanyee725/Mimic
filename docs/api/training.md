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
| POST | `/training/jobs/{id}/pod/terminate` | | `TrainJob` (podState terminated) | Terminate now |
| GET | `/training/jobs/{id}/metrics?fromStep=0&maxPoints=2000` | | `Metrics` — averaged into at most `maxPoints` buckets | Metrics plots (history) |
| GET | `/training/jobs/{id}/command` | | `{ command: string }` — the exact `lerobot-train` command line | Confirm dialog / params preview |
| POST | `/training/command-preview` | same body as POST `/training/jobs` | `{ command, ratePerHr?, capHours?, maxCostUsd? }` | Confirm dialog |
| GET | `/training/jobs/{id}/checkpoints/{step}/download` | | `application/zip` | Download |
| POST | `/training/jobs/{id}/checkpoints/{step}/push` | `{ repo?: string }` | `202` | Push to HF Hub |
| POST | `/training/jobs/{id}/checkpoints/{step}/save` | `{ name }` | `201 Model` | Save to Models |

Live: `training.updated` (status, step, eta, cost, pod state, new checkpoint) and `training.metrics` (one sample per step) events.

## Changes from the web mocks

`elapsed` / `eta` strings → `elapsedS` / `etaS`; `podState.idleFor` → `idleForS`; RunPod config and lerobot params move
from frontend constants to `/training/config`.
