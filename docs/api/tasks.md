# Tasks and sessions

A task defines what to record (instruction, rig, cameras, rates, episode counts, subtasks) and where: on the real rig,
or in an Isaac Sim environment (`envId`, the **Isaac Sim** tag on the Tasks page). Web: `api/tasks.ts`, `api/sessions.ts`.

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
  envId: string | null       // Isaac Sim environment (simulation.md); null = real task
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
  collected: number          // read-only: the task's recordings that are not rejected (accepted + pending), counted live
  version: number            // read-only, +1 on every update
  updatedAt: string          // read-only, ISO
  updatedBy: string          // read-only, operator ID
}

TaskInput = Task without collected / version / updatedAt / updatedBy

SessionStatus = "review" | "reviewed"   // review: some episodes are still pending
Session = { id: string; taskId: string; operator: string | null; episodes: number; accepted: number;
            successPct: number; failPct: number; status: SessionStatus; date: string }
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/tasks?status=` | | `Task[]` | `listTasks()` |
| GET | `/tasks/{id}` | | `Task` | `getTask(id)` |
| POST | `/tasks` | `TaskInput` | `201 Task` (version 1); 409 if id exists | Tasks "+" |
| PUT | `/tasks/{id}` | `TaskInput & { version }` (`id` optional; 422 if it differs from the path) | `Task`; 409 on stale version (`details.current`) | Tasks Save |
| POST | `/tasks/{id}/duplicate` | `{ id, name }` | `201 Task` (status draft) | Tasks Duplicate |
| DELETE | `/tasks/{id}` | | `204`; 409 if it has recordings (`details.recordings` = count) | — |
| GET | `/tasks/{id}/yaml` | | `text/yaml` | Tasks YAML tab |
| POST | `/tasks/import` | `text/yaml` (same format) | `201 Task`; 422 with line errors | Tasks Import YAML |
| GET | `/sessions?taskId=` | | `Session[]` derived from recordings (newest first) | `listSessions()` |

Validation: `rigId` must exist; `cameras` ⊆ rig camera keys; `actionHz` ∈ rig `actionHzOptions`; `videoFps` ∈ rig `videoFpsOptions`;
`envId`, when set, must be a
registered environment (`/sim/envs`, a USD stage; else 422 on `envId` "unknown environment"); subtask keys unique; outcome values unique; `id` is a slug (`^[a-z0-9][a-z0-9-]{0,63}$`); `targetEpisodes` ≥ 1, `durationS` > 0,
`cameras` and `outcomes` non-empty. Rule failures return `422` with `details.errors = [{ loc: ["body", field, ...], msg }]`.
`updatedBy` comes from the `X-Operator` header (pseudonymous ID matching `^OP-\d{2}$`, else 422), default `OP-01`.

An Isaac Sim task keeps the rig: its joints, cameras and rates define the data, the real leader arm drives the simulated
follower, and recordings carry the environment as `simEnv` ([recordings.md](recordings.md)). Capture on it answers 503
until the Isaac Sim bridge exists ([capture.md](capture.md)).

Events: `task.created` / `task.updated` (data `Task`), `task.deleted` (data `{ id }`).

### Task YAML

```yaml
task_id: stack-two-blocks
name: Stack two blocks
label: stack the blue block on top of the red block
tags: [pick-place, tabletop]
rig: so101-kit
env: tabletop                                      # optional: Isaac Sim task (a registered USD stage); omit for the real rig
cameras: [top, wrist]
rates: { action_hz: 60, video_fps: 30 }
episode: { target: 50, duration_s: 30, reset_s: 10, countdown_s: 3 }
variants: [put the blue block on the red one]      # optional, default []
outcomes: { success: "→", fail: F, partial: P }    # optional, default as shown
subtasks:                                          # optional, default []
  - { key: "1", name: reach, description: 블록으로 접근 }
success_criteria: ...                              # optional, default ""
status: active                                     # optional; import defaults to draft
output:
  repo_id: local/stack_two_blocks
  format: lerobot_v3                               # only lerobot_v3
  fps: 30                                          # must equal rates.video_fps
  push_to_hub: private                             # private | public | true → pushToHub true; false → false
```

`GET /tasks/{id}/yaml` emits every key above (export → import round-trips). `POST /tasks/import` returns
`422` with `details.errors = [{ line, loc, msg }]` (`line` is 1-based, `loc` the YAML key path), and `409` if `task_id` exists.

### Storage

Each task is one file, `data/tasks/<task-id>.yaml` (`config.data_dir`, git-ignored): the Task YAML above plus a trailing
`meta:` block with `version`, `updated_at` and `updated_by`. Create / update / duplicate / import rewrite the file; delete
removes it. On startup the folder is loaded (hand edits apply; a broken file is logged and skipped; `task_id` inside the file
wins over the file name, and the file is renamed). There are no seeds: a missing or empty folder means no tasks.
`POST /tasks/import` ignores `meta` (version restarts at 1); `GET /tasks/{id}/yaml` does not emit it.

`collected` is never stored (an old `meta.collected` is ignored): it is the number of the task's recordings whose review is
not `rejected`, so it follows saves, reviews and deletes without changing `version`.

### Sessions

Sessions are not stored: recordings are grouped by task and station day (`recordedAt` in the station time zone).
`id = "<taskId>-<YYYY-MM-DD>"`, `episodes` = recordings, `accepted` = review accepted, `successPct` / `failPct` = share of
outcomes `success` / `fail` (one decimal), `status` = `review` while any episode is pending, else `reviewed`, `operator` =
`null` (recordings do not carry the operator yet). No recordings → `[]`.

## Changes from the web mocks

`updatedAt` becomes ISO 8601. `Session.operator` is nullable and `SessionStatus` is `"review" | "reviewed"`.
