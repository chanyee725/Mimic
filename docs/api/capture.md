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
| POST | `/capture/start` | `{ taskId, operator }` | `CaptureState` (countdown → recording); 404 unknown task; 409 if not idle; 503 if a rig device is off (`details.devices` = their ids) — always today, since no device drivers exist yet | Space |
| POST | `/capture/subtask` | `{ index }` | `CaptureState` (writes a `/labels/subtask` event at the current time); 409 unless recording; 422 index out of range | 1–4 |
| POST | `/capture/stop` | | `CaptureState` (phase review); 409 unless recording | Space |
| POST | `/capture/save` | `{ outcome: Outcome }` | `201 Recording` (review "pending"); phase idle; 409 unless recording / review | → / F / P |
| POST | `/capture/rerecord` | | `CaptureState` (discards and restarts the same episode); 409 if idle | ← |
| POST | `/capture/discard` | | `CaptureState` (deletes the file; phase idle); 409 if idle | Esc |

Phase changes are pushed as `capture.state` events. Saving also emits `recording.created`.

## Behaviour

- Start runs the task's `countdownS` countdown, then records. Recording stops by itself at the task's `durationS` (phase review).
- Saving while still recording stops implicitly. The episode number is
  `max(task.collected, highest recorded episode, last issued) + 1`, so numbers are never reused after a delete.
  A save does not touch the task: `collected` is counted from the recordings ([tasks.md](tasks.md)).
- Starting a task with subtasks places the first marker (index 0) at 0 s. Consecutive markers become `subtasks` spans; the last
  one ends at the episode end.
- The saved recording's topics follow the rig (one action topic per leader device, one state topic per follower, one
  `/cam_<key>/image` per task camera, `/labels/subtask` when the task has subtasks, `/labels/outcome`).
