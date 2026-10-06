# Capture

Controls episode recording on the station. One episode = one MCAP file. Live camera video and joint data do not go through
REST: see [realtime.md](realtime.md) (WebRTC and gRPC). Web: `features/capture/hooks/use-episode.ts` (local state machine today).

## Types

```ts
CapturePhase = "idle" | "countdown" | "recording" | "review"
CaptureState = {
  phase: CapturePhase
  taskId: string | null          // when idle: the task of the last saved / discarded episode
  operator: string | null        // pseudonymous ID matching ^OP-\d{2,}$
  episodeId: string | null       // recording being written, "<taskId>-<episode>"
  startedAt: string | null       // when recording begins (after the countdown)
  elapsedS: number               // 0 during the countdown, frozen in review
  subtaskIndex: number | null    // current subtask marker (0-based index into task.subtasks)
  nextEpisode: number            // episode number the current / next recording gets
}
```

## Endpoints

| Method | Path | Body | Returns | UI |
| --- | --- | --- | --- | --- |
| GET | `/capture/state` | | `CaptureState` | Capture load |
| POST | `/capture/start` | `{ taskId, operator }` | `CaptureState` (countdown → recording); 404 unknown task; 409 if not idle; 503 `Isaac Sim teleoperation is not connected yet` when the task's rig is a sim rig ([rigs.md](rigs.md#sim-rigs)); 503 if a rig device is off (`details.devices` = their ids); starts the rig's teleoperation when it is not running (its 409 / 503 apply, see [rigs.md](rigs.md)) | Space |
| POST | `/capture/subtask` | `{ index }` | `CaptureState` (writes a `/labels/subtask` event at the current time); 409 unless recording; 422 index out of range | 1–4 |
| POST | `/capture/stop` | | `CaptureState` (phase review); 409 unless recording | Space |
| POST | `/capture/save` | `{ outcome: Outcome }` | `201 Recording` (review "pending"); phase idle; 409 unless recording / review | → / F / P |
| POST | `/capture/rerecord` | | `CaptureState` (discards and restarts the same episode); 409 if idle | ← |
| POST | `/capture/discard` | | `CaptureState` (deletes the file; phase idle); 409 if idle | Esc |

Phase changes are pushed as `capture.state` events. Saving also emits `recording.created`.

## Behaviour

- Start makes sure the rig's teleoperation runs (leader drives follower, [rigs.md](rigs.md)); it keeps running after
  save / discard so the follower never drops between episodes (stop it from the Rigs page). Without device access
  (LeRobot missing, tests) nothing is started.
- Start runs the task's `countdownS` countdown, then records. Recording stops by itself at the task's `durationS` (phase review).
- Saving while still recording stops implicitly. The episode number is
  `max(task.collected, highest recorded episode, last issued) + 1`, so numbers are never reused after a delete.
  A save does not touch the task: `collected` is counted from the recordings ([tasks.md](tasks.md)).
- Starting a task with subtasks places the first marker (index 0) at 0 s. Consecutive markers become `subtasks` spans; the last
  one ends at the episode end.
- The saved recording's topics follow the rig (one action topic per leader device, one state topic per follower, one
  `/cam_<key>/image` per task camera, `/labels/subtask` when the task has subtasks, `/labels/outcome`).
- Saving writes the teleoperation samples whose wall time falls in the recording window
  `[recording start, recording start + duration]` (leader action → `/action`, follower state → `/observation/state`,
  times from the recording start). Episode metadata `source` is `teleop`; without samples (no device access) the file
  holds the mock trajectory and `source` is `mock`.
- Cameras: Start (and Re-record) opens a recorder for each task camera (`task.cameras` keys → the rig cameras' ports) on the
  camera hub ([rigs.md](rigs.md)); it keeps every frame from Start. Saving writes the frames in the recording window to
  `/cam_<key>/image` (JPEG, [recordings.md](recordings.md)); save, Discard and Re-record release the cameras. Without device
  access no camera is recorded. A camera that fails to open makes Start answer 503.
- Video checks: `Video <key>` = `frames / duration × videoFps` (ok at ≥ 95%); late frames are listed in `drops`.
- Checks from the samples: `Action samples` / `State samples` = `n / duration × actionHz` (ok at ≥ 95%), `Timestamp gap`
  = the largest gap between samples or at either end of the window (ok at ≤ 3 sample periods).
