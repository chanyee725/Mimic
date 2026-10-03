# Realtime

Three channels besides REST:

| Channel | Transport | Data |
| --- | --- | --- |
| Events | WebSocket `/api/v1/ws/events` | Resource changes and job progress (JSON) |
| Robot data | gRPC `RobotStream` on `:50051` (grpc-web / Connect from the browser) | 60 Hz joint action / state, measured rates |
| Video | WebRTC, signalling over REST | Camera tracks (30 fps), Isaac Sim live view |

## Events WebSocket

`GET /api/v1/ws/events?topics=training,sim` (no `topics` = all). Server → client messages:

```json
{ "type": "training.updated", "at": "2026-10-02T14:05:00+09:00", "data": { "...": "TrainJob" } }
```

| type | data | Topic |
| --- | --- | --- |
| `capture.state` | `CaptureState` | capture |
| `recording.created` / `recording.updated` | `Recording` | recordings |
| `recording.deleted` | `{ id }` | recordings |
| `dataset.updated` | `Dataset` | datasets |
| `training.updated` | `TrainJob` | training |
| `training.metrics` | `{ jobId, step, values: Record<MetricSeries, number> }` | training |
| `evaluate.run` | `EvalRun` | evaluate |
| `sim.updated` | `SimJob` | sim |
| `sim.episode` | `{ jobId, episode: SimEpisode }` | sim |
| `sim.envs` | `{ envs: SimEnv[] }` after a rescan | sim |
| `device.updated` | `Device` | devices |
| `station.warnings` | `string[]` | station |

Client → server: `{ "type": "ping" }` → `{ "type": "pong" }`. The server sends `{ "type": "hello", "topics": [...] }` on connect.

- The topic is taken from the type prefix (`recording.*` → `recordings`, `device.*` → `devices`, …, per the table).
- Unknown topic names are not an error: they are left out of `hello.topics` and listed in `hello.ignored`
  (`{ "type": "hello", "topics": ["training"], "ignored": ["bogus"] }`).
- Other client messages (unknown types, invalid JSON) are ignored. Slow clients drop events (queue of 1000) rather than
  blocking publishers; reload the resource over REST after a reconnect.

## gRPC robot stream

`backend/proto/robot.proto`:

```proto
syntax = "proto3";
package vla.robot.v1;

message JointFrame {
  int64 t_ns = 1;                // station monotonic clock
  repeated float action = 2;     // leader (or policy) command, rig joint order, degrees
  repeated float state = 3;      // follower measured position, degrees
}
message StreamRequest { string rig_id = 1; uint32 hz = 2; }   // hz = 0 → native rate
message RatesRequest  { string rig_id = 1; }
message Rates { float action_hz = 1; float state_hz = 2; }

service RobotStream {
  rpc StreamJoints(StreamRequest) returns (stream JointFrame);
  rpc StreamRates(RatesRequest) returns (stream Rates);     // ~2 Hz, measured over the last 2 s
}
```

The web JointPlots read frames into their ring buffer (no React state per sample). Evaluate uses the same stream: `action` is the policy output.

## WebRTC

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/webrtc/offer` | `{ sdp, type: "offer", source: "rig" \| "sim", rigId?, simJobId?, cameras: string[] }` | `{ sessionId, sdp, type: "answer", tracks: { camera: string; mid: string }[] }` |
| DELETE | `/webrtc/sessions/{id}` | | `204` |

- `sdp` must be non-empty and `cameras` non-empty; `rigId` is required for `source: "rig"`, `simJobId` for `"sim"` (`422`).
- Unknown `rigId` → `404`. `DELETE` of an unknown session → `404`.
- The answer carries `sessionId`, used by `DELETE /webrtc/sessions/{id}` to hang up.

STUN / TURN come from `settings.connection.webrtc`. Until the camera pipeline exists a valid offer answers
`501` with `{ "error": { "code": "not_implemented", ... } }`.
