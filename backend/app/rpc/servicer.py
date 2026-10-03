"""RobotStream gRPC service (proto/robot.proto), backed by the mock joint source."""

import asyncio
import time
from collections.abc import AsyncIterator, Awaitable, Callable

import grpc

from app.services import mock_robot
from app.rpc.gen import robot_pb2, robot_pb2_grpc
from app.models.rigs import Rig
from app.services.rigs import get_rig

MAX_HZ = 1000
RATES_PERIOD_S = 0.5  # ~2 Hz


class RobotStreamService(robot_pb2_grpc.RobotStreamServicer):
    """clock (monotonic ns) and sleep are injectable so tests run without real time."""

    def __init__(
        self,
        clock: Callable[[], int] = time.monotonic_ns,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._clock = clock
        self._sleep = sleep

    async def _rig(self, rig_id: str, context: grpc.aio.ServicerContext) -> Rig:
        rig = get_rig(rig_id)
        if rig is None:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"Rig '{rig_id}' does not exist")
        return rig

    async def _ticks(self, hz: float) -> AsyncIterator[int]:
        """Yields station-clock timestamps (ns) on a fixed grid, without drift."""
        period_ns = round(1e9 / hz)
        next_ns = self._clock()
        while True:
            delay = (next_ns - self._clock()) / 1e9
            if delay > 0:
                await self._sleep(delay)
            yield next_ns
            next_ns += period_ns

    async def StreamJoints(
        self, request: robot_pb2.StreamRequest, context: grpc.aio.ServicerContext
    ) -> AsyncIterator[robot_pb2.JointFrame]:
        rig = await self._rig(request.rig_id, context)
        if request.hz > MAX_HZ:
            await context.abort(
                grpc.StatusCode.INVALID_ARGUMENT, f"hz must be between 0 and {MAX_HZ}"
            )
        hz = request.hz or rig.target_hz.action
        async for t_ns in self._ticks(hz):
            action, state = mock_robot.joint_frame(len(rig.joints), t_ns / 1e9)
            yield robot_pb2.JointFrame(t_ns=t_ns, action=action, state=state)

    async def StreamRates(
        self, request: robot_pb2.RatesRequest, context: grpc.aio.ServicerContext
    ) -> AsyncIterator[robot_pb2.Rates]:
        rig = await self._rig(request.rig_id, context)
        target = rig.target_hz.action
        async for t_ns in self._ticks(1 / RATES_PERIOD_S):
            t = t_ns / 1e9
            yield robot_pb2.Rates(
                action_hz=mock_robot.measured_rate(target, t),
                state_hz=mock_robot.measured_rate(target, t, phase=1.3),
            )
