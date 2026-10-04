# Conversion, merge and datasets

Convert turns a task's accepted MCAP recordings into a LeRobot v3.0 dataset (dataset fps = task video fps, action
downsampled). Merge combines ready LeRobot datasets into a new one. Every dataset is a real LeRobot v3.0 folder on disk —
there is no mock data. Web: `api/datasets.ts`, Convert page, Datasets page.

## Types

```ts
DatasetKind = "lerobot" | "mcap"                 // only "lerobot" exists today
DatasetStatus = "ready" | "converting" | "failed"
DatasetFeature = { key: string; dtype: string; shape: string; note?: string | null }
DatasetEpisode = { index: number; source: string; lengthS: number; frames: number }
Dataset = {
  kind: DatasetKind; repoId: string; taskId: string; rigId: string
  format: string; fps: number                    // format "LeRobot v3.0"
  status: DatasetStatus; progress?: number | null // 0–99 while converting / merging, null otherwise
  error?: string | null                          // when failed
  createdAt: string; sizeGB: number              // sizeGB: files on disk (0 while converting)
  hub: { pushed: boolean; private: boolean }
  features: DatasetFeature[]
  episodeCount: number
  sources?: string[] | null                      // merged datasets: the repoIds it was made from; null for converted ones
}

ConvertPreview = { fps: number; actionHz: number; features: DatasetFeature[]; episodes: number;
                   frames: number; lengthS: number; mcapMB: number; estOutputMB: number;
                   recordedFrom: string | null; recordedTo: string | null }   // null when there are no episodes

MergeSource = { repoId: string; episodes: number; frames: number; fps: number; rigId: string; taskId: string }
MergePreview = {
  sources: MergeSource[]                         // the sources that exist and are ready, in request order
  fps: number | null                             // common fps, null when they differ (or no source)
  episodes: number; frames: number; sizeGB: number   // sums over `sources`
  features: DatasetFeature[]                     // of the first source
  problems: string[]                             // human-readable; [] = mergeable
}
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/convert/preview?taskId=&exclude=id1,id2` | | `ConvertPreview` for the task's accepted recordings minus `exclude` | Convert summary / features |
| POST | `/convert` | `{ taskId, repoId, exclude?: string[], format: "lerobot_v3" }` | `202 Dataset` (converting); 409 if repoId exists; 422 if no accepted recordings | Convert button |
| GET | `/datasets/merge/preview?sources=a/b,c/d` | | `MergePreview` | Merge dialog |
| POST | `/datasets/merge` | `{ sources: string[], repoId }` | `202 Dataset` (converting, `sources` set); 409 if repoId exists; 422 with `details.problems` if not mergeable | Merge button |
| GET | `/datasets?kind=&q=` | | `Dataset[]` newest first | `listDatasets()` |
| GET | `/datasets/{repoId}` | | `Dataset` (`repoId` is URL-encoded, e.g. `local%2Fstack_two_blocks`) | Datasets detail |
| GET | `/datasets/{repoId}/episodes?limit=&cursor=` | | `Page<DatasetEpisode>` (empty while converting) | Datasets episodes |
| GET | `/datasets/{repoId}/thumbnail` | | `image/jpeg`: first frame of the first episode of the first video feature (made once, cached as `meta/thumbnail.jpg`); 404 when the dataset has no video feature; 409 while it is not ready | Dataset thumbnail |
| POST | `/datasets/{repoId}/push` | `{ private: boolean }` | `202 Dataset`; 409 unless status ready; 424 if HF token missing | Push to HF Hub |
| DELETE | `/datasets/{repoId}` | | `204` (removes the folder; cancels a running conversion / merge) | Delete |

Progress: `dataset.updated` events (`progress`, `status`, `error`). Deleting emits `dataset.deleted` with `{ repoId }`.

### Notes

- `repoId` must match `<namespace>/<name>` (letters, digits, `_ . -`; neither part may start with `.`), else 422. The path
  also accepts it unencoded (`/datasets/local/stack_two_blocks/episodes`). 404 for an unknown task or dataset. The
  `/datasets/merge…` routes are matched before `/datasets/{repoId}`, so `merge` cannot be a namespace with a `preview` name.
- Preview features are what convert writes: `action` and `observation.state` float32 `[joints]` (joint count from the task's
  rig; action notes `"<actionHz> Hz → <fps> Hz"` when they differ), `timestamp` float32 `[1]`, `frame_index`,
  `episode_index`, `index`, `task_index`, `subtask_index` int64 `[1]`, plus one video feature
  `observation.images.<key>` (`video` `[height, width, 3]`) per camera that **every** converted recording has frames for
  (shape from the rig camera resolution in the preview, from the frames themselves on convert). A camera missing in any
  recording is left out of the dataset and listed in `station.yaml` as `skipped_cameras`. `frames` = Σ floor(duration ×
  fps), `estOutputMB` = 0.6 × `mcapMB` (estimate only).
- Convert runs in a background thread: it starts `converting` at progress 0 and publishes progress per episode (capped at
  99); on success it becomes `ready` (`progress` null) with the real `episodeCount` / `sizeGB`; on any error it becomes
  `failed` with `error` (e.g. `"stack-two-blocks/ep_0002.mcap: MCAP could not be read: …"`) and nothing is left on disk.
  A failed dataset stays listed until deleted (or restart).
- Each frame k is at `k / fps` s; `action` and `observation.state` take the latest MCAP message at or before that time
  (60 Hz → 30 Hz keeps every second action). `subtask_index` is the `/subtask` span covering the frame, `-1` outside spans.
  Joint names are `<joint>.pos` (lerobot convention). One task per dataset: `task` = the task's instruction.
- Merge: sources must exist, be `ready`, be at least two (no duplicates), share fps, rig (`rigId`) and features (keys,
  dtype, shape, names). Problem texts: `Pick at least two datasets to merge`, `Dataset 'a/b' does not exist`,
  `Dataset 'a/b' is not ready (converting)`, `Dataset 'a/b' is listed more than once`,
  `Frame rates differ: a/b 30 fps, c/d 15 fps`, `Robots differ: a/b so101-kit, c/d so101-bimanual-kit`,
  `Features differ: c/d has …` / `… lacks …`, `Feature 'action' differs: a/b float32 [6], c/d float32 [5]`,
  `Feature 'action' has different names in c/d`. Video features follow the same rules (so different cameras or
  resolutions are rejected); their episodes are decoded from the sources' video files and re-encoded.
- The merged dataset copies episodes in source order: `episode_index` 0…n-1, `index` 0…frames-1, tasks and subtasks
  unioned (first-seen order) with `task_index` / `subtask_index` remapped. `taskId` = the common task, or `"mixed"` when the
  sources come from different tasks. Episode `source` keeps the original recording file.
- `q` matches `repoId` or `taskId` (case-insensitive substring). Push only records `hub` in `station.yaml` (no upload yet).

## Storage

`<data_dir>/datasets/<namespace>/<name>/` (`config.datasets_dir`; `data_dir` = `VLA_DATA_DIR`, default `data/`, not
committed). The folder is a LeRobot v3.0 dataset (lerobot `CODEBASE_VERSION = "v3.0"`, written with pyarrow):

```
meta/info.json                               codebase_version, fps, features, total_episodes / frames / tasks,
                                             chunks_size 1000, data_files_size_in_mb 100, video_files_size_in_mb 200,
                                             data_path, video_path (null without video features), robot_type (= rig id),
                                             splits {"train": "0:N"}
meta/stats.json                              per feature: min, max, mean, std, count, q01, q10, q50, q90, q99
                                             (video features: per channel, shape [3, 1, 1], 0–1, on sampled frames
                                             like lerobot compute_stats)
meta/tasks.parquet                           task (pandas index) → task_index
meta/subtasks.parquet                        subtask (pandas index) → subtask_index (station extra)
meta/episodes/chunk-000/file-000.parquet     episode_index, tasks, length, data/chunk_index, data/file_index,
                                             dataset_from_index, dataset_to_index, meta/episodes/chunk_index,
                                             meta/episodes/file_index, stats/<feature>/<stat>, and per video key
                                             videos/<key>/chunk_index, file_index, from_timestamp, to_timestamp
data/chunk-XXX/file-YYY.parquet              one row per frame, no video columns (new file every ~100 MB,
                                             1000 files per chunk)
videos/<key>/chunk-XXX/file-YYY.mp4          H.264 (libx264, yuv420p) at fps; episodes back to back (frame k of an
                                             episode at from_timestamp + k / fps, the latest camera frame at or
                                             before k / fps); new file once one passes ~200 MB
meta/thumbnail.jpg                           made on the first thumbnail request
station.yaml                                 station metadata: task_id, rig_id, created_at, hub, notes, sources,
                                             episode_sources (recording file per episode), skipped_cameras
```

Example `meta/info.json` of a converted dataset:

```json
{
  "codebase_version": "v3.0",
  "fps": 30,
  "features": {
    "action": { "dtype": "float32", "shape": [6], "names": ["shoulder_pan.pos", "shoulder_lift.pos", "elbow_flex.pos",
                                                            "wrist_flex.pos", "wrist_roll.pos", "gripper.pos"] },
    "observation.state": { "dtype": "float32", "shape": [6], "names": ["shoulder_pan.pos", "…", "gripper.pos"] },
    "timestamp": { "dtype": "float32", "shape": [1], "names": null },
    "frame_index": { "dtype": "int64", "shape": [1], "names": null },
    "episode_index": { "dtype": "int64", "shape": [1], "names": null },
    "index": { "dtype": "int64", "shape": [1], "names": null },
    "task_index": { "dtype": "int64", "shape": [1], "names": null },
    "subtask_index": { "dtype": "int64", "shape": [1], "names": null }
  },
  "total_episodes": 3,
  "total_frames": 270,
  "total_tasks": 1,
  "chunks_size": 1000,
  "data_files_size_in_mb": 100,
  "video_files_size_in_mb": 200,
  "data_path": "data/chunk-{chunk_index:03d}/file-{file_index:03d}.parquet",
  "video_path": null,
  "robot_type": "so101-kit",
  "splits": { "train": "0:3" }
}
```

- The index is rebuilt on start by scanning `<datasets>/*/*/meta/info.json` (hidden folders skipped). Folders that are not
  v3.0 or lack features are logged and skipped. Folders without `station.yaml` (e.g. copied from the Hub) are listed with
  `taskId` `"unknown"`, `rigId` from `robot_type`, `createdAt` from the info.json mtime.
- Conversions and merges write into `.<name>.partial-<id>/` and rename it to `<name>/` when complete.

## Changes from the web mocks

`episodes` moves to the paged `/episodes` endpoint; the dataset carries `episodeCount`. `createdAt` becomes ISO. No seed
datasets: the list starts empty. Merge and `sources` are new.
