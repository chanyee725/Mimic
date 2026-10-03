import asyncio
import inspect

import grpc
import pytest

from app.services.realtime import mock_robot
from app.rpc.gen import robot_pb2
from app.rpc.server import serve
from app.rpc.servicer import RobotStreamService
from conftest import connect_devices


@pytest.fixture(autouse=True)
def devices(request):
    # No drivers: streams are refused unless a test pretends the arms are connected
    if "unavailable" not in request.node.name:
        connect_devices()


class Aborted(Exception):
    pass


class FakeContext:
    async def abort(self, code: grpc.StatusCode, details: str):
        self.code, self.details = code, details
        raise Aborted(details)


class FakeTime:
    """Monotonic clock that only moves when the service sleeps."""

    def __init__(self, start_ns: int = 10_000_000_000) -> None:
        self.ns = start_ns
        self.sleeps: list[float] = []

    def clock(self) -> int:
        return self.ns

    async def sleep(self, s: float) -> None:
        self.sleeps.append(s)
        self.ns += round(s * 1e9)


def take(gen, n: int) -> list:
    async def run():
        out = []
        async for item in gen:
            out.append(item)
            if len(out) == n:
                break
        await gen.aclose()
        return out

    return asyncio.run(run())


def service(t: FakeTime) -> RobotStreamService:
    return RobotStreamService(clock=t.clock, sleep=t.sleep)


def test_stream_joints_native_rate():
    t = FakeTime()
    req = robot_pb2.StreamRequest(rig_id="so101-kit")
    frames = take(service(t).StreamJoints(req, FakeContext()), 4)
    # so101-kit: 6 joints, native 60 Hz
    assert all(len(f.action) == 6 and len(f.state) == 6 for f in frames)
    gaps = [b.t_ns - a.t_ns for a, b in zip(frames, frames[1:])]
    assert gaps == [round(1e9 / 60)] * 3
    assert frames[0].t_ns == 10_000_000_000


def test_stream_joints_values_match_mock_signal():
    t = FakeTime()
    req = robot_pb2.StreamRequest(rig_id="so101-kit", hz=30)
    frames = take(service(t).StreamJoints(req, FakeContext()), 3)
    assert frames[1].t_ns - frames[0].t_ns == round(1e9 / 30)
    f = frames[2]
    ts = f.t_ns / 1e9
    for i in range(6):
        assert f.action[i] == pytest.approx(mock_robot.sample(i, ts), abs=1e-3)
        # state lags action by 0.15 s
        assert f.state[i] == pytest.approx(mock_robot.sample(i, ts - 0.15), abs=1e-3)
        assert -90 <= f.action[i] <= 90


def test_stream_joints_is_deterministic():
    req = robot_pb2.StreamRequest(rig_id="so101-kit")
    a = take(service(FakeTime()).StreamJoints(req, FakeContext()), 3)
    b = take(service(FakeTime()).StreamJoints(req, FakeContext()), 3)
    assert a == b


def test_stream_joints_unknown_rig():
    ctx = FakeContext()
    req = robot_pb2.StreamRequest(rig_id="nope")
    with pytest.raises(Aborted):
        take(service(FakeTime()).StreamJoints(req, ctx), 1)
    assert ctx.code == grpc.StatusCode.NOT_FOUND


def test_stream_joints_rejects_absurd_rate():
    ctx = FakeContext()
    req = robot_pb2.StreamRequest(rig_id="so101-kit", hz=100_000)
    with pytest.raises(Aborted):
        take(service(FakeTime()).StreamJoints(req, ctx), 1)
    assert ctx.code == grpc.StatusCode.INVALID_ARGUMENT


def test_stream_rates():
    t = FakeTime()
    rates = take(
        service(t).StreamRates(robot_pb2.RatesRequest(rig_id="so101-kit"), FakeContext()), 3
    )
    assert t.sleeps == [0.5, 0.5]
    for r in rates:
        assert 59 < r.action_hz <= 60
        assert 59 < r.state_hz <= 60


def test_stream_rates_unknown_rig():
    ctx = FakeContext()
    with pytest.raises(Aborted):
        take(service(FakeTime()).StreamRates(robot_pb2.RatesRequest(rig_id="nope"), ctx), 1)
    assert ctx.code == grpc.StatusCode.NOT_FOUND


@pytest.mark.parametrize("method", ["StreamJoints", "StreamRates"])
def test_unavailable_without_connected_devices(method):
    ctx = FakeContext()
    req = (robot_pb2.StreamRequest if method == "StreamJoints" else robot_pb2.RatesRequest)(
        rig_id="so101-kit"
    )
    with pytest.raises(Aborted):
        take(getattr(service(FakeTime()), method)(req, ctx), 1)
    assert ctx.code == grpc.StatusCode.UNAVAILABLE
    assert ctx.details == "Rig 'so101-kit' devices are not connected: follower, leader"


def test_unavailable_when_one_arm_is_off():
    from app.services import rigs

    connect_devices()
    rigs.set_device_state("leader", health="off")
    ctx = FakeContext()
    with pytest.raises(Aborted):
        take(service(FakeTime()).StreamJoints(robot_pb2.StreamRequest(rig_id="so101-kit"), ctx), 1)
    assert ctx.code == grpc.StatusCode.UNAVAILABLE and ctx.details.endswith(": leader")


def test_serve_is_importable():
    # Not started in tests (no sockets); just check the entry point exists
    assert inspect.iscoroutinefunction(serve)
