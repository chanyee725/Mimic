"""gRPC server for RobotStream. Run: uv run python -m app.realtime.grpc_server [--port 50051]"""

import argparse
import asyncio
import logging

import grpc

from app.realtime.grpc_gen import robot_pb2_grpc
from app.realtime.grpc_service import RobotStreamService

log = logging.getLogger(__name__)


async def serve(port: int = 50051) -> grpc.aio.Server:
    """Starts the server on [::]:port and returns it (caller waits / stops it)."""
    server = grpc.aio.server()
    robot_pb2_grpc.add_RobotStreamServicer_to_server(RobotStreamService(), server)
    server.add_insecure_port(f"[::]:{port}")
    await server.start()
    log.info("RobotStream gRPC listening on :%d", port)
    return server


async def _main(port: int) -> None:
    server = await serve(port)
    try:
        await server.wait_for_termination()
    finally:
        await server.stop(grace=1)


def main() -> None:
    parser = argparse.ArgumentParser(description="RobotStream gRPC server (mock source)")
    parser.add_argument("--port", type=int, default=50051)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(_main(args.port))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
