# Rigs and devices

A rig is a fixed set of hardware (follower robot, leader arm, cameras) that a task records with. Web: `api/rigs.ts`, `api/devices.ts`.

## Types

```ts
RigCamera = { id: string; key: string; name: string; feature: string; resolution: string; fps: number; defaultOn: boolean }
Rig = {
  id: string; name: string
  master: string; slave: string          // display names (leader / follower)
  robots: string[]; devices: string[]    // device ids
  cameras: RigCamera[]
  joints: string[]                       // action vector order
  targetHz: { action: number; video: number }
  actionHzOptions: number[]; videoFpsOptions: number[]
}

DeviceType = "robot" | "teleop" | "camera" | "glove" | "input"
Health     = "ok" | "warn" | "off"
DeviceStream = { key: string; shape: string; targetHz: number | null; measuredHz: number | null; unit: "Hz" | "fps" }
Device = { id: string; name: string; type: DeviceType; port: string; health: Health;
           calibration: { done: boolean; note: string }; streams: DeviceStream[]; stats: { label: string; value: string }[] }
```

## Endpoints

| Method | Path | Returns | Web |
| --- | --- | --- | --- |
| GET | `/rigs` | `Rig[]` | `listRigs()` |
| GET | `/rigs/{id}` | `Rig`; **404** if unknown (the web mock falls back to the first rig — the client keeps that fallback) | `getRig(id)` |
| GET | `/rigs/{id}/yaml` | `text/yaml` | Rigs Config tab |
| GET | `/rigs/{id}/devices` | `Device[]` in Robot → Device → Camera order (`robots`, then `devices`, then camera ids) | `devicesOf(rigId)` |
| GET | `/devices` | `Device[]` | `listDevices()` |
| GET | `/devices/{id}` | `Device` | Rigs detail |
| POST | `/devices/{id}/calibrate` | `202 Device` with `calibration: { done: false, note: "Calibrating…" }` (result on the events socket); 409 if already calibrating; 503 if `health` is `off` | Rigs Calibrate |

`measuredHz` and `health` are live values; changes are also pushed as `device.updated` events ([realtime.md](realtime.md)).
Calibration start and finish are `device.updated` events too (the mock backend finishes right after the response).

### Rig YAML

The rig in its file format (see [Storage](#storage)), as the backend writes it (no comments). Read-only in v1 (rigs are not edited through the API).

## Storage

- Rigs: one hand-editable file per rig in `data/rigs/<rig-id>.yaml` (under `VLA_DATA_DIR`); the id is read from the file content. The folder is committed to git (the station ships with `so101-kit`).
- On startup the folder is loaded if it exists; otherwise it is seeded from the mocks and written. Add a rig by dropping a file in (restart to pick it up). Invalid files (missing robot, rate not in its options, camera without a `WxH` resolution, duplicate device ids, …) are logged and skipped; unknown keys are logged and ignored. Seeded rigs keep their mock order; new files follow, by file name.
- Old-format files (a raw `Rig` dump with `master` / `slave`) are converted on load and rewritten in this format.

```yaml
id: so101-kit
name: SO-101 Kit

# Follower arm: executes actions, publishes observation.state
robot:
  id: follower
  type: so101_follower          # hardware type (not in the API)
  name: SO-101 Follower
  port: /dev/so101_follower
  joints: [shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper]

# Teleop leader arm: the operator moves it, it publishes action
device:
  id: leader
  type: so101_leader
  name: SO-101 Leader
  port: /dev/so101_leader

# Cameras by key
cameras:
  top:
    # id: cam-top               # device id, defaults to the key
    name: Top camera
    port: /dev/cam_top
    resolution: 640x480         # "x" or "×"
    fps: 30                     # defaults to rates.video_fps
    default_on: true            # defaults to true

rates:
  action_hz: 60                 # one of action_hz_options (defaults to [action_hz])
  video_fps: 30                 # one of video_fps_options (defaults to [video_fps])
  action_hz_options: [30, 60]
  video_fps_options: [15, 30]
```

- Multi-arm rigs use maps keyed by id instead: `robots: { bi-follower-l: {type, name, port, joints}, bi-follower-r: {…} }` and `devices: { … }`. Either form loads; the backend writes the singular form when there is exactly one. Every robot has the same number of joints, and joint names are unique across robots.
- Mapping to `Rig`: `slave` / `master` = the robot / device names (one name as is; `X (L)` + `X (R)` → `X ×2`; otherwise joined with ` + `); `robots` / `devices` = their ids; `joints` = the robots' joints in order; camera `id` = `id` or the key, `feature` = `observation.images.<key>`, `resolution` as `640×480`; `targetHz` = `rates.action_hz` / `rates.video_fps`.
- Devices are the ones declared in the rig files (id, name, port; type robot → `robot`, device → `teleop`, camera → `camera`); the first rig declaring an id wins. Live state (health, calibration, streams, stats) comes from the mocks by id and stays in memory. A device without mock state starts offline: `health: off`, calibration not done, streams derived from the file (`observation.state` / `action` shape `[n_joints]` at `action_hz`, `images.<key>` shape `HxWx3` at the camera fps), no stats. Mock devices no rig declares are dropped. Calibration results are not written to disk.
