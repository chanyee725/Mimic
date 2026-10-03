# Conversion and datasets

Convert turns a task's accepted MCAP recordings into a LeRobot v3.0 dataset (dataset fps = camera fps, action downsampled).
Datasets also include raw MCAP bundles. Web: `api/datasets.ts`, Convert page.

## Types

```ts
DatasetKind = "lerobot" | "mcap"
DatasetStatus = "ready" | "converting" | "failed"
DatasetFeature = { key: string; dtype: string; shape: string; note?: string }
DatasetEpisode = { index: number; source: string; lengthS: number; frames: number }
Dataset = {
  kind: DatasetKind; repoId: string; taskId: string; rigId: string
  format: string; fps: number
  status: DatasetStatus; progress?: number      // 0–100 while converting
  error?: string                                 // when failed
  createdAt: string; sizeGB: number
  hub: { pushed: boolean; private: boolean }
  features: DatasetFeature[]
  episodeCount: number
}

ConvertPreview = { fps: number; actionHz: number; features: DatasetFeature[]; episodes: number;
                   frames: number; lengthS: number; mcapMB: number; estOutputMB: number;
                   recordedFrom: string | null; recordedTo: string | null }   // null when there are no episodes
```

## Endpoints

| Method | Path | Body | Returns | Web |
| --- | --- | --- | --- | --- |
| GET | `/convert/preview?taskId=&exclude=id1,id2` | | `ConvertPreview` for the task's accepted recordings minus `exclude` | Convert summary / features |
| POST | `/convert` | `{ taskId, repoId, exclude?: string[], format: "lerobot_v3" }` | `202 Dataset` (converting); 409 if repoId exists; 422 if no accepted recordings | Convert button |
| GET | `/datasets?kind=&q=` | | `Dataset[]` newest first | `listDatasets()` |
| GET | `/datasets/{repoId}` | | `Dataset` (`repoId` is URL-encoded, e.g. `local%2Fstack_two_blocks`) | Datasets detail |
| GET | `/datasets/{repoId}/episodes?limit=&cursor=` | | `Page<DatasetEpisode>` | Datasets episodes |
| GET | `/datasets/{repoId}/thumbnail` | | `image/jpeg` (first camera frame of the first episode; `501` until storage exists) | Dataset thumbnail |
| POST | `/datasets/{repoId}/push` | `{ private: boolean }` | `202 Dataset`; 409 unless status ready; 424 if HF token missing | Push to HF Hub |
| DELETE | `/datasets/{repoId}` | | `204` (cancels a running conversion) | Delete |

Progress: `dataset.updated` events (`progress`, `status`). Deleting emits `dataset.deleted` with `{ repoId }`.

### Notes

- `repoId` must match `<namespace>/<name>` (letters, digits, `_ . -`), else 422. The path also accepts it unencoded
  (`/datasets/local/stack_two_blocks/episodes`). 404 for an unknown task or dataset.
- Preview features: `action` and `observation.state` float32 `[joints]` (action notes `"<actionHz> Hz → <fps> Hz"` when they
  differ), one `video` feature per task camera (rig camera `feature`, shape `[h, w, 3]`, note `AV1`), then `subtask_index`,
  `timestamp`, `frame_index`, `episode_index`, `task_index`. `fps` = task video fps, `frames` = Σ round(duration × fps),
  `estOutputMB` = 0.6 × `mcapMB`.
- A new dataset starts `converting` at progress 0, `hub.private: true`. Until the converter exists, progress is simulated
  (10 % per second); at 100 the dataset becomes `ready` (`progress` omitted) with one episode per source recording in episode
  order, `sizeGB` = estimated output.
- `q` matches `repoId` or `taskId` (case-insensitive substring). Push currently only marks `hub.pushed` (no upload yet).

## Changes from the web mocks

`episodes` moves to the paged `/episodes` endpoint; the dataset carries `episodeCount`. `createdAt` becomes ISO.
