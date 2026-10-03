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
| GET | `/rigs/{id}/devices` | `Device[]` in Robot → Device → Camera order | `devicesOf(rigId)` |
| GET | `/devices` | `Device[]` | `listDevices()` |
| GET | `/devices/{id}` | `Device` | Rigs detail |
| POST | `/devices/{id}/calibrate` | `202 Device` (calibration runs; result on the events socket) | Rigs Calibrate |

`measuredHz` and `health` are live values; changes are also pushed as `device.updated` events ([realtime.md](realtime.md)).
