"""Episode MCAP files: JSON channels for action, state and subtask labels (no camera frames yet).

Channels: /action and /observation/state ({"position": [deg per joint]}) at the task's action
rate, /subtask ({"name", "start_s", "end_s"}) at each span start. Log times are nanoseconds
since the epoch, starting at the recording start. One metadata record ("episode") holds
the task id, episode, operator and outcome.
"""

import bisect
import io
import json
import struct
from dataclasses import dataclass, field
from pathlib import Path

from mcap.exceptions import McapError
from mcap.reader import make_reader
from mcap.writer import Writer

from app.models.recordings import McapTopic, SubtaskSpan
from app.services.realtime import mock_robot

ACTION_TOPIC = "/action"
STATE_TOPIC = "/observation/state"
SUBTASK_TOPIC = "/subtask"
METADATA_NAME = "episode"
# Samples topic name (API) → channel
SAMPLE_CHANNELS = {"action": ACTION_TOPIC, "state": STATE_TOPIC}

_JOINT_SCHEMA = {
    "type": "object",
    "properties": {"position": {"type": "array", "items": {"type": "number"}}},
}
_SUBTASK_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "start_s": {"type": "number"},
        "end_s": {"type": "number"},
    },
}
# Channel → (schema name, kind)
_SCHEMAS = {
    ACTION_TOPIC: ("vla.robot.JointCommand", "action"),
    STATE_TOPIC: ("vla.robot.JointState", "state"),
    SUBTASK_TOPIC: ("vla.session.SubtaskEvent", "label"),
}


class McapReadError(Exception):
    """The file is missing, not an MCAP, or lacks the expected channels."""


@dataclass
class Episode:
    """Everything needed to synthesise one episode file (mock signal until real hardware)."""

    start_ns: int
    duration_s: float
    hz: float
    joints: list[str]
    seed: float  # mock trajectory per recording
    subtasks: list[SubtaskSpan] = field(default_factory=list)
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def n_samples(self) -> int:
        return round(self.duration_s * self.hz)


def topics(ep: Episode) -> list[McapTopic]:
    """Topic rows for the Recording, matching what write() puts in the file."""
    rows = [
        McapTopic(
            name=name,
            schema_=_SCHEMAS[name][0],
            kind=_SCHEMAS[name][1],
            rate_hz=ep.hz,
            messages=ep.n_samples,
        )
        for name in (ACTION_TOPIC, STATE_TOPIC)
    ]
    if ep.subtasks:
        rows.append(
            McapTopic(
                name=SUBTASK_TOPIC,
                schema_=_SCHEMAS[SUBTASK_TOPIC][0],
                kind="label",
                rate_hz=None,
                messages=len(ep.subtasks),
            )
        )
    return rows


def _json(data: object) -> bytes:
    return json.dumps(data, separators=(",", ":")).encode()


def encode(ep: Episode) -> bytes:
    """The episode as MCAP bytes (messages in log-time order)."""
    buf = io.BytesIO()
    w = Writer(buf)
    w.start(profile="", library="vla-station")
    channels: dict[str, int] = {}
    for name in (ACTION_TOPIC, STATE_TOPIC, SUBTASK_TOPIC):
        if name == SUBTASK_TOPIC and not ep.subtasks:
            continue
        schema_name = _SCHEMAS[name][0]
        body = _SUBTASK_SCHEMA if name == SUBTASK_TOPIC else _JOINT_SCHEMA
        schema_id = w.register_schema(name=schema_name, encoding="jsonschema", data=_json(body))
        meta = {} if name == SUBTASK_TOPIC else {"joints": ",".join(ep.joints)}
        channels[name] = w.register_channel(
            topic=name, message_encoding="json", schema_id=schema_id, metadata=meta
        )

    # (log time, channel, payload); sorted so readers see time order
    out: list[tuple[int, str, bytes]] = []
    n_joints = len(ep.joints)
    for k in range(ep.n_samples):
        t = k / ep.hz
        ns = ep.start_ns + round(t * 1e9)
        state_t = max(0.0, t - mock_robot.STATE_LAG_S)
        action = [round(mock_robot.sample(i, t, ep.seed), 3) for i in range(n_joints)]
        state = [round(mock_robot.sample(i, state_t, ep.seed), 3) for i in range(n_joints)]
        out.append((ns, ACTION_TOPIC, _json({"position": action})))
        out.append((ns, STATE_TOPIC, _json({"position": state})))
    for sp in ep.subtasks:
        ns = ep.start_ns + round(sp.start_s * 1e9)
        out.append((ns, SUBTASK_TOPIC, _json(sp.model_dump(mode="json"))))
    out.sort(key=lambda m: m[0])

    seq: dict[str, int] = {}
    for ns, name, data in out:
        seq[name] = seq.get(name, 0) + 1
        w.add_message(
            channel_id=channels[name],
            log_time=ns,
            publish_time=ns,
            sequence=seq[name],
            data=data,
        )
    w.add_metadata(name=METADATA_NAME, data=ep.metadata)
    w.finish()
    return buf.getvalue()


@dataclass
class JointSeries:
    joints: list[str]
    # Channel → (seconds since the first sample, positions per sample)
    series: dict[str, tuple[list[float], list[list[float]]]]


def read_joints(path: Path, channels: list[str]) -> JointSeries:
    """Joint positions of the given channels; times start at the earliest of them."""
    raw: dict[str, tuple[list[int], list[list[float]]]] = {c: ([], []) for c in channels}
    joints: list[str] = []
    try:
        with path.open("rb") as f:
            reader = make_reader(f)
            for _, channel, msg in reader.iter_messages(topics=channels, log_time_order=True):
                if not joints and channel.metadata.get("joints"):
                    joints = channel.metadata["joints"].split(",")
                ts, values = raw[channel.topic]
                ts.append(msg.log_time)
                values.append([float(v) for v in json.loads(msg.data)["position"]])
    except (OSError, McapError, struct.error, ValueError, KeyError, TypeError, IndexError) as e:
        raise McapReadError(f"MCAP could not be read: {e}") from e
    missing = [c for c in channels if not raw[c][0]]
    if missing:
        raise McapReadError(f"MCAP has no messages on {missing}")
    t0 = min(raw[c][0][0] for c in channels)
    if not joints:
        joints = [f"joint_{i}" for i in range(1, len(raw[channels[0]][1][0]) + 1)]
    return JointSeries(
        joints=joints,
        series={c: ([(t - t0) / 1e9 for t in ts], v) for c, (ts, v) in raw.items()},
    )


def resample(times: list[float], values: list[list[float]], at: list[float]) -> list[list[float]]:
    """Linear interpolation per joint (held flat outside the recorded range): [joint][sample]."""
    n_joints = len(values[0])
    out: list[list[float]] = [[] for _ in range(n_joints)]
    last = len(times) - 1
    for t in at:
        k = bisect.bisect_right(times, t)
        if k == 0 or last == 0:
            row = values[0]
        elif k > last:
            row = values[last]
        else:
            t0, t1 = times[k - 1], times[k]
            a = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            v0, v1 = values[k - 1], values[k]
            row = [x0 + (x1 - x0) * a for x0, x1 in zip(v0, v1)]
        for j in range(n_joints):
            out[j].append(round(row[j], 3))
    return out
