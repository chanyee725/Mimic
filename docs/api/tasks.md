# Tasks and sessions

A task defines what to record (instruction, rig, cameras, rates, episode counts, subtasks). Web: `api/tasks.ts`, `api/sessions.ts`.

## Types

```ts
TaskStatus = "active" | "draft" | "completed"
Outcome    = "success" | "fail" | "partial"
Subtask    = { key: string; name: string; description: string }   // key = hotkey ("1".."9")

Task = {
  id: string                 // slug, immutable (e.g. "stack-two-blocks")
  name: string
  instruction: string        // language label used for training
  variants: string[]
  tags: string[]
  rigId: string
  cameras: string[]          // rig camera keys recorded for this task
  actionHz: number           // one of the rig's actionHzOptions
  videoFps: number           // one of the rig's videoFpsOptions
  targetEpisodes: number
  durationS: number
  resetS: number
  countdownS: number
  outcomes: { value: Outcome; key: string }[]
  subtasks: Subtask[]
  successCriteria: string
  repoId: string             // default dataset name, e.g. "local/stack_two_blocks"
  pushToHub: boolean
  status: TaskStatus
  collected: number          // read-only: accepted + pending capture episodes
  version: number            // read-only, +1 on every update
  updatedAt: string          // read-only, ISO
  updatedBy: string          // read-only, operator ID
}

TaskInput = Task without collected / version / updatedAt / updatedBy

SessionStatus = "recording" | "review" | "converted"
Session = { id: string; taskId: string; operator: string; episodes: number; accepted: number;
            successPct: number; failPct: number; status: SessionStatus; date: string }
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/tasks?status=` | | `Task[]` | `listTasks()` |
| GET | `/tasks/{id}` | | `Task` | `getTask(id)` |
| POST | `/tasks` | `TaskInput` | `201 Task` (version 1); 409 if id exists | Tasks "+" |
| PUT | `/tasks/{id}` | `TaskInput & { version }` | `Task`; 409 on stale version | Tasks Save |
| POST | `/tasks/{id}/duplicate` | `{ id, name }` | `201 Task` (status draft) | Tasks Duplicate |
| DELETE | `/tasks/{id}` | | `204`; 409 if it has recordings | — |
| GET | `/tasks/{id}/yaml` | | `text/yaml` | Tasks YAML tab |
| POST | `/tasks/import` | `text/yaml` (same format) | `201 Task`; 422 with line errors | Tasks Import YAML |
| GET | `/sessions?taskId=` | | `Session[]` (newest first) | `listSessions()` |

Validation: `rigId` must exist; `cameras` ⊆ rig camera keys; `actionHz` ∈ rig `actionHzOptions`; `videoFps` ∈ rig `videoFpsOptions`;
subtask keys unique; `updatedBy` comes from the `X-Operator` header (pseudonymous ID), default `OP-01`.

### Task YAML

```yaml
task_id: stack-two-blocks
name: Stack two blocks
label: stack the blue block on top of the red block
tags: [pick-place, tabletop]
rig: so101-kit
cameras: [top, wrist]
rates: { action_hz: 60, video_fps: 30 }
episode: { target: 50, duration_s: 30, reset_s: 10, countdown_s: 3 }
output:
  repo_id: local/stack_two_blocks
  format: lerobot_v3
  fps: 30
  push_to_hub: private
```

## Changes from the web mocks

`updatedAt` becomes ISO 8601.
