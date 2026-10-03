# Station

Station identity and dashboard numbers. Web: `api/station.ts`, `api/devices.ts#getStationWarnings`, sidebar header.

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
| GET | `/station/activity?weeks=52` | `DayCount[]` — one entry per day, oldest first, ending today; the first day is a Sunday | `getEpisodeActivity()` |
| GET | `/station/warnings` | `string[]` — human-readable hardware warnings (low camera fps, hot motor) | `getStationWarnings()` |
| GET | `/station/current-task` | `{ taskId: string \| null }` | `getCurrentTaskId()` |
| PUT | `/station/current-task` | body `{ taskId }` → `{ taskId }`; 404 if unknown task | Capture task picker |

## Changes from the web mocks

None.
