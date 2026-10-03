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

```yaml
rig_id: so101-kit
name: SO-101 Kit
leader: SO-101 Leader
follower: SO-101 Follower
robots: [{ id: follower, port: /dev/so101_follower }]
devices: [{ id: leader, port: /dev/so101_leader }]
cameras:
  - { key: top, device: top, name: Top camera, feature: observation.images.top, resolution: 640×480, fps: 30, default_on: true }
joints: [shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper]
rates: { action_hz: 60, video_fps: 30 }
options: { action_hz: [30, 60], video_fps: [15, 30] }
```

Read-only in v1 (rigs are not edited through the API).

## Storage

- One file per entity: `data/rigs/<rig-id>.yaml` and `data/devices/<device-id>.yaml` (under `VLA_DATA_DIR`), snake_case keys of `Rig` / `Device`. The id is read from the file content.
- On startup each folder is loaded if it exists; otherwise it is seeded from the mocks and written. Add a rig or device by dropping a file in (restart to pick it up). Invalid files are logged and skipped.
- Seeded rigs keep their mock order; new files follow, by file name.
- A finished calibration is saved to the device file; the transient `Calibrating…` state stays in memory only. `health` is saved as the last-known value.
