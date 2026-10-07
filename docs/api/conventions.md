# Conventions

## Base URL and versioning

- REST: `http://<station>:8000/api/v1` (dev: Vite proxies `/api` to `localhost:8000`).
- WebSocket: `ws://<station>:8000/api/v1/ws/...` — see [realtime.md](realtime.md).
- gRPC (60 Hz robot data): `<station>:50051` — see [realtime.md](realtime.md).
- OpenAPI: `/api/v1/openapi.json`, Swagger UI at `/api/v1/docs`.

## JSON

- Field names are **camelCase** (Pydantic models use snake_case with a camelCase alias; both are accepted on input).
- Timestamps: ISO 8601 with offset, e.g. `"2026-10-02T14:05:00+09:00"`. Dates: `"2026-10-02"`.
- Durations: seconds as numbers (`elapsedS`, `etaS`, `durationS`). Sizes: `sizeMB` / `sizeGB` as numbers. Money: USD numbers.
- Enums are lowercase strings exactly as in `web/src/domain` (`"running"`, `"on-demand"`, …).
- Optional fields are omitted or `null`; arrays are never `null`.

## Errors

Non-2xx responses share one body:

```json
{ "error": { "code": "not_found", "message": "Task 'foo' does not exist", "details": {} } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `bad_request` | Malformed input not caught by validation |
| 404 | `not_found` | Unknown id |
| 409 | `conflict` | Version mismatch, GPU busy, invalid state transition (e.g. stop a finished job) |
| 422 | `validation_error` | Request body / query failed validation (`details.errors` lists fields) |
| 424 | `dependency_failed` | External service failed or its key is missing (HF Hub, RunPod, Isaac Sim) |
| 501 | `not_implemented` | Endpoint exists but its hardware / storage layer is not built yet (file downloads, video, WebRTC) |
| 503 | `unavailable` | Hardware not connected (robot, camera) |

## Lists and paging

Small collections (tasks, rigs, devices, models, jobs, environments) return a plain array.
Large collections (recordings, dataset episodes, simulation episodes) use cursor paging:

```
GET /recordings?taskId=stack-two-blocks&limit=50&cursor=<opaque>
→ { "items": [...], "nextCursor": "<opaque>" | null, "total": 1212 }
```

`limit` defaults to 50, max 500.

## Long-running operations

Conversions, HF pushes, training, simulation and calibration run in the background. The `POST` that starts one returns
`202 Accepted` with the resource in its initial state (e.g. a dataset with `status: "converting"`, a job with `status: "queued"`).
Progress arrives on the events WebSocket ([realtime.md](realtime.md)); clients can also poll the resource.

## Concurrency

Editable documents (tasks, settings sections) carry `version: number`. Updates send the version they were based on; a stale
version returns `409 conflict` with the current document in `details.current`.

## Privacy

There are no operators or user accounts: a station is one person's collection. The API never accepts or returns real
names or emails.
Secrets (tokens, keys, webhooks) are write-only: responses carry `{ "set": true, "last4": "3kQz" }` only.

## Auth

Single-station LAN tool: no auth in v1. The server binds to the station's LAN interface only.
