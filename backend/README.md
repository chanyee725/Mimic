# backend

스테이션 백엔드 (FastAPI, Python 3.12). API 명세: [docs/api](../docs/api/README.md)

```sh
cd backend
uv sync                                   # Python 3.12 가상환경 + 의존성
uv run uvicorn app.main:app --reload      # http://localhost:8000/api/v1/docs
uv run pytest                             # 테스트
uv run black .                            # 포맷
```

구조: `app/<area>/` 마다 `router.py` · `schemas.py` · `service.py` · `seed.py`. 지금은 메모리에 목업과 같은 데이터를 두고 동작합니다.

## 목업 데이터

`app/core/seed/*.json` 은 웹 목업(`web/src/dummy`)을 그대로 내보낸 것입니다. 웹 목업을 바꾸면 다시 만듭니다:

```sh
cd web && npx tsx --tsconfig tsconfig.app.json ../backend/scripts/dump-seed.ts
```

## gRPC (로봇 60 Hz 스트림)

`proto/robot.proto` 의 `RobotStream` 서비스입니다. 지금은 목업 신호(웹 JointPlots 와 같은 사인파)를 보냅니다.

```sh
uv run python -m app.realtime.grpc_server            # :50051 (--port 로 변경)
```

proto 를 바꾸면 스텁을 다시 만들어 커밋합니다 (`app/realtime/grpc_gen/`, black 대상에서 제외):

```sh
uv run python -m grpc_tools.protoc -Iapp/realtime/grpc_gen=proto \
  --python_out=. --pyi_out=. --grpc_python_out=. app/realtime/grpc_gen/robot.proto
```

브라우저는 gRPC 를 직접 쓸 수 없으므로 grpc-web / Connect 로 Envoy(또는 비슷한) 프록시를 거쳐 연결합니다.
