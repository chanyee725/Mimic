# Models and real-robot evaluation

A model is a checkpoint folder on disk (no mock data). Evaluate runs a model on the real robot (the policy drives the
follower) and records success / fail per trial.
Web: `api/models.ts`, Models and Evaluate pages.

## Types

```ts
ModelEval = { at: string; trials: number; success: number; instruction: string }   // one Evaluate session
Model = {
  id: string; name: string; taskId: string; dataset: string; jobId: string
  step: number; loss: number; sizeMB: number; savedAt: string
  localPath?: string; hubRepo?: string        // localPath: the model folder
  evals: ModelEval[]
}
ModelFile = { path: string; sizeMB: number }

EvalRunState = "loading" | "running" | "judging" | "done"
EvalRun = { id: string; modelId: string; instruction: string; limitS?: number; speedPct?: number; record: boolean;
            state: EvalRunState; startedAt: string; elapsedS: number; result?: "success" | "fail";
            error?: string }   // why the run ended early
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/models?taskId=&location=local\|hub` | | `Model[]` newest first | `listModels()` |
| GET | `/models/{id}` | | `Model` | `getModel(id)` |
| PATCH | `/models/{id}` | `{ name }` | `Model` | — |
| DELETE | `/models/{id}` | | `204` (deletes the model folder) | Delete |
| GET | `/models/{id}/files` | | `ModelFile[]` (every file in the folder except `model.yaml`) | `getModelFiles()` |
| GET | `/models/{id}/download` | | `application/zip` (501 until storage lands) | Download |
| POST | `/models/{id}/push` | `{ repo?: string; private?: boolean }` | `202 Model` (`hubRepo` set; default `<hf namespace>/smolvla_<task>`); 424 HF token missing | Push to HF Hub |
| POST | `/evaluate/runs` | `{ modelId, instruction, limitS?, speedPct?, record }` (`limitS` optional: without it the run goes until Stop, 600 s at most; `speedPct` 0–100, optional: no speed limit by default) | `201 EvalRun` (loading); 404 unknown model; 422 empty instruction or `record: true` (not available yet); 409 if a run or capture is active, teleop runs on the rig or its follower is calibrating; 410 model files gone; 400 when the task's rig is a sim rig (use the Isaac Sim target, [simulation.md](simulation.md)); 503 no device access / port missing | Run policy (Space) |
| POST | `/evaluate/runs/{id}/stop` | | `EvalRun` (judging); 409 if not loading / running | Stop (Esc), or automatic at `limitS` / 600 s |
| POST | `/evaluate/runs/{id}/result` | `{ result: "success" \| "fail" \| "discard" }` | `EvalRun` (done; the follower is released, torque drops); success/fail are added to the model's current `ModelEval` unless the run has an `error`; 409 if not judging | S / F / Discard |
| GET | `/evaluate/runs/{id}/samples?after=-1` | | `TeleopSamples` ([rigs.md](rigs.md)): `action` = the goals sent (after the step limit), `state` = follower, last 10 s after seq `after` | Evaluate JointPlots |
| GET | `/evaluate/runs?modelId=` | | `EvalRun[]` of the current session | Trials list |
| GET | `/evaluate/runs/{id}` | | `EvalRun` | Run timer (polling) |

## Storage

`<data_dir>/models/<id>/` (`config.models_dir`): `model.yaml` plus the checkpoint files (e.g.
`pretrained_model/config.json`, `pretrained_model/model.safetensors`). `model.yaml` holds the Model fields in snake_case
(`name`, `task_id`, `dataset`, `job_id`, `step`, `loss`, `saved_at`, `hub_repo`, `evals`); `id` is the folder name,
`sizeMB` the sum of the files, `localPath` the folder. The index is rebuilt by scanning on start; folders without a valid
`model.yaml` are skipped. Rename, push (`hub_repo`) and judged trials (`evals`) rewrite `model.yaml`.

## Evaluate

- Start connects the model's task rig: its single follower (torque on) and every rig camera (a short recorder each,
  previews keep running), then loads `models/<id>/pretrained_model` with LeRobot on the GPU (about 10 s the first time;
  the last model stays loaded). `loading` → `running`.
- The loop runs at the model's dataset fps (30 if unknown): latest JPEG per camera + follower positions + instruction →
  `predict_action` (the checkpoint's preprocessor renames the cameras to camera1..3) → `send`. Without `speedPct` the
  actions go out as they are (as in lerobot); with it each joint moves at most `speedPct`% × 270°/s (the STS3215's
  unloaded top speed) ÷ fps towards the action per step (the gripper's 0–100 range by the same number). A camera silent for 1 s, a policy or robot error ends the run with
  `error`.
- Stop, the time limit (`limitS`, else 600 s) or an error moves to `judging`: no more goals are sent and the arm holds its pose with torque on
  until the verdict, which releases it.
- `record` (trial MCAPs) is not available yet.

The current `ModelEval` is the model's latest eval with the same instruction, from this session (server start) and today;
otherwise a new one is appended. A run past `limitS` moves to judging on its own.

The policy's live action and the robot state stream over gRPC ([realtime.md](realtime.md)). Run state changes: `evaluate.run` events.
