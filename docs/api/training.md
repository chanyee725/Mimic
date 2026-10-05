# Training

SmolVLA training jobs on the local GPU or a rented RunPod GPU, their per-step metrics, checkpoints and pods.
**Local jobs run `lerobot-train`** (see Local trainer below). RunPod has no trainer yet: a RunPod `POST /training/jobs`
returns `503 { "error": { "code": "unavailable", "message": "RunPod trainer is not connected yet", … } }` after
validation.
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
  localGpus: { id: string; name: string; vram: string; busyBy?: string }[]   // from nvidia-smi; [] when none
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
| POST | `/training/jobs` | `{ dataset, compute, gpu, overrides, runpod?: RunPodOptions }` | local: `202 TrainJob` (running, or queued while the GPU runs another job); RunPod: `503`; 422 invalid body | Start / Queue training (after confirm dialog) |
| POST | `/training/jobs/{id}/stop` | | `TrainJob`: a queued job is stopped at once; a running one stays `running` until its process exits, then `stopped` (event); 409 if not active | Stop training / Cancel |
| POST | `/training/jobs/{id}/pod/terminate` | | `TrainJob` (podState terminated); 409 if no pod, already terminated or the job is still active | Terminate now |
| GET | `/training/jobs/{id}/metrics?fromStep=0&maxPoints=2000` | | `Metrics` — samples after `fromStep` averaged into at most `maxPoints` buckets; `every` is in steps (a multiple of `log_freq`) | Metrics plots (history) |
| GET | `/training/jobs/{id}/log?tail=500` | | `{ lines: string[], truncated: boolean }` — the last `tail` (1–5000) lines of `train.log` from its last 512 KB, each tqdm redraw collapsed to its final state | Log dialog |
| GET | `/training/jobs/{id}/command` | | `{ command: string }` — the exact `lerobot-train` command line | Confirm dialog / params preview |
| POST | `/training/command-preview` | same body as POST `/training/jobs` | `{ command, ratePerHr?, capHours?, maxCostUsd? }` | Confirm dialog |
| GET | `/training/jobs/{id}/checkpoints/{step}/download` | | `application/zip` (501 until storage lands) | Download |
| POST | `/training/jobs/{id}/checkpoints/{step}/push` | `{ repo?: string }` | `202 { repo }` (default `<hf namespace>/smolvla_<task>`); 424 HF token missing | Push to HF Hub |
| POST | `/training/jobs/{id}/checkpoints/{step}/save` | `{ name }` | `201 Model`: copies the checkpoint's `pretrained_model/` to `models/<slug of name>/` (`-2`, `-3`… when taken), `loss` = smoothed loss at that step; 410 if the files are gone | Save to Models |

Rules:

- `localGpus` come from `nvidia-smi --query-gpu=name,memory.total` (once per process; `id` `cuda:<n>`, `name` as reported,
  e.g. `NVIDIA GeForce RTX 4090`, `vram` rounded GB). The RunPod catalogue (GPUs, `stock`, prices, regions, volumes) is a
  static option list, not live availability.
- `command-preview` validates: `dataset` ∈ `trainableDatasets`; `gpu` is a local GPU id or name, or a
  RunPod GPU name (stock `none` → 409; non-community GPU on the community cloud → 422); `runpod.region` / `runpod.volume` exist;
  every `overrides` key is in `paramGroups` and matches the default's type (bool / integer ≥ 0, `steps` · `batch_size` ·
  `save_freq` · `log_freq` ≥ 1 / numeric string). Field errors come back as 422 with `details.errors[].loc`.
- `runpod` defaults to `runpod.defaults` when omitted. A RunPod job's `pricePerHr` is the rate with the options applied
  (`base × gpuCount × priceFactor.cloud × priceFactor.pricing`).
- Preview: `capHours` = `min(maxHours, budget / rate)` when a budget is set, else `maxHours`; omitted when there is no limit.
- Stop: a running pod is terminated (`autoTerminate`) or goes idle.
- Command: always `--policy.path`, `--dataset.repo_id`, `--dataset.root` (the dataset folder), `--policy.device=cuda`,
  `--policy.push_to_hub=false`, `--wandb.enable=false`; a job adds `--output_dir` / `--job_name`; `steps` / `batch_size`
  come from the job, other flags only when they differ from the defaults. The dataset's cameras are renamed to the
  base model's `observation.images.camera1..3` with `--rename_map` (feature order); more than 3 cameras → 422.

## Local trainer

- `lerobot-train` (the one in the backend venv; needs the `lerobot[training,smolvla]` extras) runs as its own process
  session with `CUDA_VISIBLE_DEVICES` = the picked GPU, so a backend restart does not stop it. One job per GPU; others
  wait `queued` and start oldest first when it ends.
- Job folder `<data_dir>/training/<job id>/`: `job.yaml` (TrainJob in snake_case + `pid`, `gpu_index`), `train.log`
  (stdout + stderr), `metrics.jsonl` (one `{ step, values }` per metric line) and `output/` (lerobot's `output_dir`;
  checkpoints in `output/checkpoints/<step>/pretrained_model`). Job ids `job_NNN` never reuse a folder's number.
- The log is followed every 0.5 s: tqdm gives `step`, `etaS`, `stepsPerS`; each metric line (every `log_freq` steps)
  gives `loss_raw`, `grad_norm`, `lr`, `update_s`, `data_s`, `gpu_mem` (GB, `mem_gb`) and `epoch`, plus `loss` (EMA,
  weight 0.3) and `gpu_util` (nvidia-smi). A checkpoint is listed once `checkpoints/last` points at it. `elapsedS` is
  wall time since start (model loading included).
- Exit: `stopped` after Stop (SIGTERM to the process group, SIGKILL after 15 s), `done` after "End of training" or exit
  code 0, else `failed` with the last exception line of the log as `error`.
- On start the backend loads every `job.yaml`; a `running` job whose process is still alive is followed again, otherwise
  it turns `failed` ("Trainer stopped while the backend was down"). Queued jobs start in turn.

Live: `training.updated` (status, step, eta, cost, pod state, new checkpoint) and `training.metrics` (one sample per step) events.

## Changes from the web mocks

`elapsed` / `eta` strings → `elapsedS` / `etaS`; `podState.idleFor` → `idleForS`; RunPod config and lerobot params move
from frontend constants to `/training/config`. No seed jobs, no mock metrics; `localGpus` is detected, not a constant.
Stop does not save a last checkpoint (lerobot-train is killed); the checkpoints saved so far stay.
