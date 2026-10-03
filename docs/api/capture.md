# Capture

Controls episode recording on the station. One episode = one MCAP file. Live camera video and joint data do not go through
REST: see [realtime.md](realtime.md) (WebRTC and gRPC). Web: `features/capture/hooks/use-episode.ts` (local state machine today).

## Types

```ts
CapturePhase = "idle" | "countdown" | "recording" | "review"
CaptureState = {
  phase: CapturePhase
  taskId: string | null
  operator: string | null
  episodeId: string | null       // recording being written
  startedAt: string | null
  elapsedS: number
  subtaskIndex: number | null    // current subtask marker
  nextEpisode: number            // episode number the next recording gets
}
```

## Endpoints

| Method | Path | Body | Returns | UI |
| --- | --- | --- | --- | --- |
| GET | `/capture/state` | | `CaptureState` | Capture load |
| POST | `/capture/start` | `{ taskId, operator }` | `CaptureState` (countdown → recording); 409 if not idle; 503 if a rig device is off | Space |
| POST | `/capture/subtask` | `{ index }` | `CaptureState` (writes a `/labels/subtask` event at the current time) | 1–4 |
| POST | `/capture/stop` | | `CaptureState` (phase review) | Space |
| POST | `/capture/save` | `{ outcome: Outcome }` | `201 Recording` (review "pending"); phase idle | → / F / P |
| POST | `/capture/rerecord` | | `CaptureState` (discards and restarts) | ← |
| POST | `/capture/discard` | | `CaptureState` (deletes the file; phase idle) | Esc |

Phase changes are pushed as `capture.state` events. Saving also emits `recording.created`.
