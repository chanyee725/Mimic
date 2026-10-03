# VLA Data Pipeline — Backend API

Specification of the station backend that replaces the web app's mocks (`web/src/dummy`, read through `web/src/api`).
Every function in `web/src/api` maps to an endpoint here; actions that are no-ops in the UI today (Start, Stop, Save, Push, …) are specified too.

| File | Area | Web pages |
| --- | --- | --- |
| [conventions.md](conventions.md) | Base URL, JSON casing, errors, paging, async operations | all |
| [station.md](station.md) | Station info, dashboard totals, activity, warnings | Dashboard, sidebar |
| [tasks.md](tasks.md) | Tasks, task YAML, sessions | Tasks, Capture, Dashboard |
| [rigs.md](rigs.md) | Rigs, devices, calibration | Rigs, Capture |
| [capture.md](capture.md) | Episode recording control | Capture |
| [recordings.md](recordings.md) | Raw MCAP recordings, review, replay | Review, Convert |
| [datasets.md](datasets.md) | Conversion to LeRobot, datasets, HF Hub push | Convert, Datasets |
| [training.md](training.md) | Training config, jobs, metrics, checkpoints, RunPod pods | Training, Dashboard |
| [models.md](models.md) | Saved models, real-robot evaluation | Models, Evaluate |
| [simulation.md](simulation.md) | Isaac Sim environments (folder-registered) and evaluation jobs | Simulation |
| [settings.md](settings.md) | Settings, secrets, connection tests, disk | Settings |
| [realtime.md](realtime.md) | WebSocket events, gRPC robot stream, WebRTC cameras | Capture, Evaluate, Training, Simulation |

## Implementation

- FastAPI, Python 3.12, Pydantic v2, formatted with black. Code lives in [`backend/`](../../backend).
- Layered: `backend/app/api/v1/routers/<area>.py`, `schemas/<area>.py`, `models/<area>.py`, `services/<area>.py`, `seeds/`, `configs/`.
- Until the hardware and storage layers exist, services keep state in memory, seeded with the same data as the web mocks.

## Frontend mapping

`web/src/api/<module>.ts` keeps its function names; only the bodies change from returning mocks to calling these endpoints
(TanStack Query for REST, a WebSocket hook for events). Field names in responses match `web/src/domain` types, except where
noted under **Changes from the web mocks** in each file (mainly: durations in seconds and ISO timestamps instead of preformatted strings).
