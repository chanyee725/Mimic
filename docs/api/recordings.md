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
| GET | `/recordings/{id}/file` | | `application/octet-stream` MCAP download | — |
| GET | `/recordings/{id}/samples?topics=action,state&fromS=0&toS=30&hz=60` | | `{ joints: string[], t: number[], series: { [topic]: number[][] } }` (resampled for plots) | Review JointPlots |
| GET | `/recordings/{id}/video/{camera}` | | `video/mp4` with Range support | Review VideoTile |
| POST | `/recordings/import` | multipart `file` (.mcap) | `201 Recording` (source external) | — |

Changes are pushed as `recording.created` / `recording.updated` / `recording.deleted`.

## Changes from the web mocks

`recordedAt` becomes ISO 8601. The list is paged; the web store keeps loading pages for the selected task.
