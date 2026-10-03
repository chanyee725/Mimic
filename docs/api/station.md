# Station

Station identity and dashboard numbers, computed from the rig files, recordings and the data folder (nothing is seeded).
Web: `api/station.ts`, `api/devices.ts#getStationWarnings`, sidebar header.

## Types

```ts
Station   = { id: string; robot: string; date: string }            // date = station's today (YYYY-MM-DD)
DataTotal = { key: "episodes" | "frames" | "hours" | "storage" | "success"; label: string; value: string }  // value pre-formatted
DayCount  = { date: string; count: number }
```

## Endpoints

| Method | Path | Returns | Web |
| --- | --- | --- | --- |
| GET | `/station` | `Station` | `getStation()` |
| GET | `/station/totals` | `DataTotal[]` (episodes, frames, hours, storage, success — in that order) | `getDataTotals()` |
| GET | `/station/activity?weeks=52` | `DayCount[]` — one entry per day, oldest first, ending today; the first day is a Sunday (`weeks` 1–104) | `getEpisodeActivity()` |
| GET | `/station/warnings` | `string[]` — human-readable warnings from real conditions | `getStationWarnings()` |
| GET | `/station/current-task` | `{ taskId: string \| null }` (`null` until set, and once the task is deleted) | `getCurrentTaskId()` |
| PUT | `/station/current-task` | body `{ taskId }` → `{ taskId }`; `null` clears it; 404 if unknown task. Publishes `station.current_task` | Capture task picker |

## Values

- `Station.id` = `VLA_STATION_ID` (default `Station 01`); `robot` = name of the current task's rig, else of the first rig
  (rig files sorted by file name), else `"No rig"`; `date` = today in the station time zone.
- Totals (all recordings, any review state; `0` when nothing is computable):
  - `episodes` = number of recordings (`"1,212"`).
  - `frames` = Σ `durationS × fps`, fps = the recording's task `videoFps`, else its rig's `targetHz.video`, else 0 (`"799,200"`).
  - `hours` = Σ `durationS` / 3600, one decimal (`"7.4 h"`).
  - `storage` = size of the whole data folder, one decimal (`"84.3 GB"`, GiB).
  - `success` = recordings with outcome `success` / reviewed recordings (review `accepted` or `rejected`), rounded; `"0%"`
    when none are reviewed.
- Activity: recordings per station day (`recordedAt` in the station time zone).
- Warnings, in this order, only when true:
  - `"<n> devices not connected: <names>"` — rig devices with `health: off` (today: all of them, no drivers yet).
  - `"Data disk <pct>% full"` — the disk holding the data folder is more than 90 % used.
- Current task: kept in memory, `null` after a restart.

## Changes from the web mocks

Every value is computed (the mock station, totals, activity and warnings are gone). `robot` is the rig name (e.g.
`"SO-101 Kit"`), and the current task starts as `null`.
