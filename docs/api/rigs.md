# Rigs and devices

A rig is a fixed set of hardware (follower robot, leader arm, cameras) that a task records with. Web: `api/rigs.ts`, `api/devices.ts`.
Real devices are reached through LeRobot (`backend/app/services/rigs/driver.py`, the `hardware` dependency group): port
scan, camera preview, connection test, arm calibration and a teleoperation test.

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
DeviceCheck = { ok: boolean; message: string; at: string }   // last connection test (ISO 8601)
Device = { id: string; name: string; type: DeviceType; port: string; health: Health;
           calibration: { done: boolean; note: string }; streams: DeviceStream[]; stats: { label: string; value: string }[];
           check: DeviceCheck | null }

Port = { path: string; device: string; kind: "serial" | "video"; label: string; usedBy: string[] }

CalibrationStep = "center" | "range" | "done" | "failed"
MotorRange = { name: string; pos: number | null; min: number | null; max: number | null; fullTurn: boolean }
CalibrationSession = { deviceId: string; step: CalibrationStep; message: string; motors: MotorRange[];
                       file: string | null; startedAt: string }

TeleopJoint = { name: string; leader: number | null; follower: number | null }   // LeRobot units (degrees, gripper 0–100)
TeleopPair  = { robot: string; teleop: string; joints: TeleopJoint[] }           // follower id, leader id
TeleopState = { rigId: string; running: boolean; hz: number | null; targetHz: number; error: string | null;
                startedAt: string; pairs: TeleopPair[] }
TeleopSamples = { joints: string[]; seq: number; t: number[]; action: number[][]; state: number[][] }
                // rig joint order (pairs concatenated); t = seconds since the session started; 3 decimals
```

## Endpoints

| Method | Path | Returns | Web |
| --- | --- | --- | --- |
| GET | `/rigs` | `Rig[]` | `listRigs()` |
| GET | `/rigs/{id}` | `Rig`; **404** if unknown (the web mock falls back to the first rig — the client keeps that fallback) | `getRig(id)` |
| GET | `/rigs/{id}/yaml` | `text/yaml`: the rig file as it is on disk (comments and written ports included) | Rigs Config tab |
| POST | `/rigs/{id}/teleop` | `201 TeleopState`: connects every leader / follower pair and starts the loop. 400 unless the rig has one leader per follower; 409 if already running or a rig arm is calibrating, or an arm has no calibration file (`Calibrate '<id>' first`); 503 if a port is missing or fails to open | Test teleoperation |
| GET | `/rigs/{id}/teleop` | `TeleopState`, or `null` (200) when there is no session — polled every second on Capture and while the dialog runs | Teleoperation dialog |
| GET | `/rigs/{id}/teleop/samples?after=` | `TeleopSamples`: samples with `seq > after` (default -1), at most the last 10 s; `seq` = the last returned sample, or `after` when none. 404 when there is no session | Capture live plots (poll with the last `seq`) |
| DELETE | `/rigs/{id}/teleop` | 204; disconnects the arms (followers drop torque). 404 when there is none | Stop |
| GET | `/rigs/{id}/devices` | `Device[]` in Robot → Device → Camera order (`robots`, then `devices`, then camera ids) | `devicesOf(rigId)` |
| POST | `/rigs/{id}/test` | `Device[]` (same order as `/rigs/{id}/devices`) after a connection test of every device: arms in parallel, cameras one at a time (shared USB bandwidth). Devices that are calibrating, in a teleoperation test or recording are returned untested. 503 if LeRobot is unavailable | Rigs: run when a rig is first shown, and by Test all |
| GET | `/devices` | `Device[]` | `listDevices()` |
| GET | `/devices/{id}` | `Device` | Rigs detail |
| GET | `/devices/ports` | `Port[]`: USB serial ports (`/dev/ttyACM*`, `/dev/ttyUSB*`), then video capture nodes (index 0 only). `path` is the `/dev/serial/by-id` link for serial ports (unique adapter serial) and the `/dev/v4l/by-path` link (USB position; identical cameras often share a serial) for video, else the node; `usedBy` = devices whose port is the path or the node | Rigs port picker, Rescan ports |
| GET | `/devices/ports/preview?path=` | `multipart/x-mixed-replace; boundary=frame`: live JPEG frames (MJPG 640×480, about 12 fps) for an `<img>`. Only a scanned video port's `path` or `device` (else 400); 503 if it does not open or gives no frame. Frames come from the camera hub: one reader per camera (opened at the rig camera's resolution / fps when the port belongs to a rig camera, else 640×480 @ 30) shared by previews and Capture recorders, closed with its last subscriber. One preview per camera: opening another one closes the previous stream; a connection test of a device on the camera closes its previews and reader. A stream ends after 30 s (the web reopens it every 25 s) or when the client disconnects | Port dialog previews |
| PUT | `/devices/{id}/port` | Body `{ port }` (absolute path, else 400) → `Device`. Written into the rig file that declares the device, in place (only the `port` value changes; comments and layout stay); resets health, stats and `check`. 409 while calibrating or in a teleoperation test | Port dialog |
| POST | `/devices/{id}/test` | `Device` after one connection test (about 1 s). 409 while calibrating, in a teleoperation test, or (cameras) while Capture records it; 503 if LeRobot is unavailable. A failed test is **200** with `check.ok: false` and `health: "off"` | Rigs Test connection |
| POST | `/devices/{id}/calibrate` | `201 CalibrationSession` in step `center` (arm opened, torque off). 400 for a camera or a non-Feetech arm; 409 if already calibrating or in a teleoperation test; 503 if the port is missing or does not open | Rigs Calibrate |
| GET | `/devices/{id}/calibration` | `CalibrationSession` with live joint positions (the web polls it every 100 ms while it runs); 404 when there is none | Calibration dialog |
| POST | `/devices/{id}/calibration/next` | `center` → `range` (writes half-turn homing offsets) → `done` (writes the calibration to the motors and saves the LeRobot file). 409 when not running, or in `range` while some joints have not moved (`details.motors`) | Next / Finish |
| DELETE | `/devices/{id}/calibration` | 204; closes the port. 404 when there is none | Cancel |

`health`, `stats`, `check` and the cameras' `measuredHz` come from the last connection test; changes are pushed as
`device.updated` events ([realtime.md](realtime.md)). Until a test runs every device is `health: "off"`, `check: null`,
`stats: []`.

### Connection test

- Arms (`robot`, `teleop`): the LeRobot robot / teleoperator for the rig `type` is built with the device port and
  `calibration_id`; its Feetech bus is opened without a handshake (nothing is written), every motor is pinged, and voltage
  / temperature are read. Stats: `Motors` (`6/6`), `Voltage` (lowest), `Temperature` (hottest), `Motor calibration`
  (`Matches file` / `Differs from file`, when a calibration file exists). Health: `ok`; `warn` when motors are missing or
  the motors' calibration differs from the file; `off` when none answer.
- Cameras: LeRobot `OpenCVCamera` opens the port at the rig resolution and fps (fails when the camera cannot), then frames
  are counted for 1 s. Stats: `Resolution`, `Frame rate`; `measuredHz` = the measured fps. `warn` below 90% of the target.
- A missing port or one that fails to open gives `check.ok: false`, `health: "off"`.

### Calibration

Arms only; mirrors LeRobot `SOFollower.calibrate()` / `SOLeader.calibrate()` with the two `input()` prompts replaced by
`calibration/next`:

1. `center` — torque off, position mode; the operator moves every joint to the middle of its range.
2. `range` — half-turn homing offsets are written; the operator sweeps every joint except full-turn ones (`wrist_roll`,
   range 0–4095) while the backend records min / max (reads every 20 ms).
3. `done` — the calibration is written to the motors and saved as LeRobot's calibration file
   in the data folder: `data/calibration/{robots|teleoperators}/<class>/<calibration_id>.json` (the backend sets
   `HF_LEROBOT_CALIBRATION` to `data/calibration` before it imports LeRobot; run LeRobot CLIs with the same variable to
   share the files).

While a session runs the device reports `calibration: { done: false, note: "Calibrating…" }`. `calibration` is otherwise
`{ done: true, note: "Calibrated · <file date>" }` when the LeRobot file exists, `{ done: false, note: "Required" }` when it
does not, and `{ done: true, note: "Not required" }` for cameras.

### Teleoperation test

- Pairs `robots[i]` (follower) with `devices[i]` (leader); both need a LeRobot calibration file. Leaders connect first,
  then followers (torque on). Motors that hold another calibration get the file's written to them (what pressing ENTER at
  LeRobot's calibrate prompt does), so `connect()` never prompts.
- A background loop runs at the rig's `action_hz`: each step reads the leader, sends it to its follower and reads the
  follower back. Every step is kept as a sample (leader action / follower state in rig joint order, wall time) for the
  last 10 minutes: the live plots read them and Capture records from them. For the first 1.5 s the follower goal is eased by time from the follower's pose at
  connect to the leader's, so a far-off pose is not reached in one jump; after that the leader action is sent as is (like
  `lerobot-teleoperate`; no `max_relative_target`, which capped moves against the present position and made the
  follower crawl under load). `hz` is the measured loop rate (per second).
- The first failing step stops the loop, disconnects and keeps `error` (`running: false`) until Stop or the next Start.
- Stop disconnects every arm; followers drop torque (LeRobot default), so **support the follower before stopping**.
- While it runs the rig's arms refuse connection tests, calibration and port changes (409).

### Rig YAML

The rig file as it is on disk (see [Storage](#storage)). The API edits only device `port` values (in place).

## Storage

- Rigs: one hand-editable file per rig in `data/rigs/<rig-id>.yaml` (under `VLA_DATA_DIR`); the id is read from the file content. The folder is committed to git (the station ships with `so101-kit`).
- On startup the folder is loaded, sorted by file name. There are no seeds: a missing or empty folder means no rigs (copy `data/rigs/*.yaml` when pointing `VLA_DATA_DIR` at a new folder). Add a rig by dropping a file in (restart to pick it up). Invalid files (missing robot, rate not in its options, camera without a `WxH` resolution, duplicate device ids, …) are logged and skipped; unknown keys are logged and ignored.
- Old-format files (a raw `Rig` dump with `master` / `slave`) are converted on load and rewritten in this format (names come from `master` / `slave`; ports start empty).

```yaml
id: so101-kit
name: SO-101 Kit

# Follower arm: executes actions, publishes observation.state
robot:
  id: follower
  type: so101_follower          # LeRobot robot / teleoperator type (not in the API)
  name: SO-101 Follower
  port: /dev/so101_follower     # set from the Rigs page (written in place)
  calibration_id: so101_follower  # LeRobot id = calibration file name; defaults to the device id
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
- Devices are the ones declared in the rig files (id, name, port; type robot → `robot`, device → `teleop`, camera → `camera`); the first rig declaring an id wins. Every device starts not connected (see above): streams are derived from the file (`observation.state` / `action` shape `[n_joints]` with `targetHz` = `action_hz`, `images.<key>` shape `HxWx3` at the camera fps, `measuredHz: null`), no stats. Test results stay in memory.
- Ports picked on the Rigs page are written into the rig file in place (`PUT /devices/{id}/port`): only the scalar after `port:` changes, so comments, key order and inline comments stay. Paths are written plain (quoted when they contain spaces or other YAML-special characters). Calibration files are LeRobot's format, kept in `data/calibration/` and committed with the rig files (see [Calibration](#calibration)).
