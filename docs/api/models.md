# Models and real-robot evaluation

A model is a checkpoint saved from a training job. Evaluate runs a model on the real robot and records success / fail per trial.
Web: `api/models.ts`, Models and Evaluate pages.

## Types

```ts
ModelEval = { at: string; trials: number; success: number; instruction: string }   // one Evaluate session
Model = {
  id: string; name: string; taskId: string; dataset: string; jobId: string
  step: number; loss: number; sizeMB: number; savedAt: string
  localPath?: string; hubRepo?: string
  evals: ModelEval[]
}
ModelFile = { path: string; sizeMB: number }

EvalRunState = "running" | "judging" | "done"
EvalRun = { id: string; modelId: string; instruction: string; limitS: number; record: boolean;
            state: EvalRunState; startedAt: string; elapsedS: number; result?: "success" | "fail" }
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/models?taskId=&location=local\|hub` | | `Model[]` newest first | `listModels()` |
| GET | `/models/{id}` | | `Model` | `getModel(id)` |
| PATCH | `/models/{id}` | `{ name }` | `Model` | — |
| DELETE | `/models/{id}` | | `204` (deletes the local folder) | Delete |
| GET | `/models/{id}/files` | | `ModelFile[]` | `getModelFiles()` |
| GET | `/models/{id}/download` | | `application/zip` | Download |
| POST | `/models/{id}/push` | `{ repo?: string; private?: boolean }` | `202 Model` | Push to HF Hub |
| POST | `/evaluate/runs` | `{ modelId, instruction, limitS, record }` | `201 EvalRun` (running); 409 if a run or capture is active; 503 robot off | Run policy (Space) |
| POST | `/evaluate/runs/{id}/stop` | | `EvalRun` (judging) | Stop (Esc), or automatic at `limitS` |
| POST | `/evaluate/runs/{id}/result` | `{ result: "success" \| "fail" \| "discard" }` | `EvalRun` (done); success/fail are added to the model's current `ModelEval` | S / F / Discard |
| GET | `/evaluate/runs?modelId=` | | `EvalRun[]` of the current session | Trials list |

The policy's live action and the robot state stream over gRPC ([realtime.md](realtime.md)). Run state changes: `evaluate.run` events.
