# Recordings

Raw MCAP files saved by Capture (or imported) and their review state. Web: `api/recordings.ts` (`useRecordings`, `setReview`, `deleteRecording`).

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
| DELETE | `/recordings/{id}` | | `204` (deletes the file) | `deleteRecording()` |
| GET | `/recordings/{id}/file` | | `application/octet-stream` MCAP download (`501` until storage exists) | — |
| GET | `/recordings/{id}/samples?topics=action,state&fromS=0&toS=30&hz=60` | | `{ joints: string[], t: number[], series: { [topic]: number[][] } }` (resampled for plots) | Review JointPlots |
| GET | `/recordings/{id}/video/{camera}` | | `video/mp4` with Range support (`501` until storage exists; 404 unknown camera) | Review VideoTile |
| POST | `/recordings/import` | multipart `file` (.mcap) | `201 Recording` (source external) | — |

Changes are pushed as `recording.created` / `recording.updated` / `recording.deleted`.

### Notes

- `limit` 1–500 (default 50). Unknown `review` / `source` values return 422.
- Samples: `topics` ⊆ `action,state`; `toS` defaults to and is clamped to the duration; `series[topic][joint][sample]`, one
  sample every `1/hz` s from `fromS`. Joints come from the rig (`joint_1…6` when the recording has no rig). Max 100,000
  samples per series, else 422. Until the MCAP reader exists the values are the web JointPlots mock signal, seeded per id.
- Import: 422 unless the name ends in `.mcap` and the file starts with the MCAP magic bytes. The id is `ext-<slug of name>`
  (suffixed `-2`, `-3`… on collision); the file is stored as `imports/<name>`. Until indexing exists `topics` is empty and
  `checks` report missing metadata (`Metadata: missing task / rig`, `Topics: not indexed yet`, both not ok).

## Changes from the web mocks

`recordedAt` becomes ISO 8601. The list is paged; the web store keeps loading pages for the selected task.
