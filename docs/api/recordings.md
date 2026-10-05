# Recordings

Raw MCAP files saved by Capture (or imported) and their review state. Only files on disk exist (no mock data). Web: `api/recordings.ts` (`useRecordings`, `setReview`, `deleteRecording`).

## Types

```ts
TopicKind = "action" | "state" | "video" | "label" | "glove" | "other"
McapTopic = { name: string; schema: string; kind: TopicKind; rateHz: number | null; messages: number }
RecordingReview = "pending" | "accepted" | "rejected"
RecordingCheck  = { label: string; value: string; ok: boolean }

Recording = {
  id: string; file: string                 // path relative to the raw folder, e.g. "stack-two-blocks/ep_0042.mcap"
  source: "capture" | "external"
  taskId?: string; rigId?: string; episode?: number
  recordedAt: string                        // ISO
  durationS: number; sizeMB: number
  outcome?: Outcome
  review: RecordingReview
  topics: McapTopic[]
  subtasks: { name: string; startS: number; endS: number }[]
  drops: number[]                           // seconds where video frames were dropped
  checks: RecordingCheck[]                  // computed when the file is indexed
}
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/recordings?taskId=&review=&source=&limit=&cursor=` | | `Page<Recording>` newest first | `useRecordings()` |
| GET | `/recordings/{id}` | | `Recording` | Review detail |
| PATCH | `/recordings/{id}` | `{ review }` | `Recording` | `setReview()` (Accept / Reject) |
| DELETE | `/recordings/{id}` | | `204` (deletes the MCAP and its sidecar) | `deleteRecording()` |
| POST | `/recordings/bulk-review` | `{ ids, review }` | `{ items: Recording[] }` (duplicates once, in `ids` order) | Review bulk Accept / Reject |
| POST | `/recordings/bulk-delete` | `{ ids }` | `204` | Review bulk Delete |
| GET | `/recordings/{id}/file` | | `application/octet-stream` MCAP download (`404` when the file is gone) | — |
| GET | `/recordings/{id}/samples?topics=action,state&fromS=0&toS=30&hz=60` | | `{ joints: string[], t: number[], series: { [topic]: number[][] } }` (resampled for plots) | Review JointPlots |
| GET | `/recordings/{id}/video/{camera}` | | `video/mp4` (H.264, Range requests → 206) of one camera (`camera` = the key in `/cam_<key>/image`); 404 for an unknown recording or a camera the recording has no `video` topic for; 422 if the MCAP frames cannot be read | Review VideoTile |
| POST | `/recordings/import` | multipart `file` (.mcap) | `201 Recording` (source external) | — |

Changes are pushed as `recording.created` / `recording.updated` / `recording.deleted`; the bulk endpoints push one
`recording.reviewed` (`{ ids, review }`) or `recording.deleted` (`{ ids }`) for the whole set.

### Notes

- `limit` 1–500 (default 50). Unknown `review` / `source` values return 422.
- Bulk: `ids` holds 1–100,000 ids (422 otherwise). Any unknown id returns 404 with `details.missing` and nothing changes.
- Samples: `topics` ⊆ `action,state`; `toS` defaults to and is clamped to the duration; `series[topic][joint][sample]`, one
  sample every `1/hz` s from `fromS`. Max 100,000 samples per series, else 422. Read from the MCAP (`/action`,
  `/observation/state`; linear interpolation; joints from the channel metadata) — a file without those channels (e.g. an
  unindexed import) or an unreadable file returns 422.
- Import: 422 unless the name ends in `.mcap` and the file starts with the MCAP magic bytes. The id is `ext-<slug of name>`
  (suffixed `-2`, `-3`… on collision); the file is stored as `imports/<name>` (`<stem>-2.mcap`… when the name is taken).
  Until indexing exists `topics` is empty and `checks` report missing metadata (`Metadata: missing task / rig`,
  `Topics: not indexed yet`, both not ok).
- Video: the first request builds an H.264 MP4 (libx264, yuv420p, faststart, PyAV) from the camera's MCAP frames and
  caches it next to the episode as `ep_<NNNN>.<key>.mp4`; later requests serve the file. The video runs at the topic's
  `rateHz` (rounded) for the recording's `durationS`, each output frame showing the last camera frame at or before its time
  (frames are held or skipped to stay in sync with the joints). A missing cache file is rebuilt.

## Storage

Recordings live in the raw folder, Settings `storage.rawPath` (default `data/recordings`, relative to the repo root, not
committed). Each one is an MCAP plus a YAML sidecar next to it — the sidecar is the index, the MCAP the payload:

```
<raw>/<task-id>/ep_<NNNN>.mcap    Capture save
<raw>/<task-id>/ep_<NNNN>.yaml    Recording fields in snake_case (`file` follows the sidecar location)
<raw>/<task-id>/ep_<NNNN>.<key>.mp4  playback cache per camera (GET …/video/{camera}), rebuilt when missing
<raw>/imports/<name>.mcap|.yaml   POST /recordings/import
```

- Capture MCAP: JSON channels `/action` and `/observation/state` (`{"position": [deg per joint]}`, channel metadata
  `joints`) at the task's action rate, `/subtask` (`{"name", "start_s", "end_s"}`) at each span start, and one metadata
  record `episode` (`source`, `recording_id`, `task_id`, `rig_id`, `episode`, `operator`, `outcome`). Each recorded camera
  adds `/cam_<key>/image` (protobuf `foxglove.CompressedImage`: `timestamp`, `frame_id` = key, `format` "jpeg", `data`;
  channel metadata `camera`), the camera's JPEG frames as captured. `topics` lists exactly the channels in the file (video
  rows: `kind` "video", `rateHz` = frames / duration, `messages` = frames) and `sizeMB` is the file size. `drops` are the
  seconds (from the start, 2 decimals) where a camera's next frame came more than 1.5 periods of the task's `videoFps`
  late.
- On start, and whenever `rawPath` changes, the backend loads every `<raw>/*/*.yaml`; a broken sidecar is logged and
  skipped. Two sidecars with the same id: the first by path wins. There are no seed recordings.
- PATCH rewrites the sidecar; DELETE removes the MCAP, the sidecar and the cached MP4s. Episode numbers count the disk recordings, so a
  restart never reuses a number that is still on disk.

## Changes from the web mocks

`recordedAt` becomes ISO 8601. The list is paged; the web store keeps loading pages for the selected task.
