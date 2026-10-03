# backend

스테이션 백엔드 (FastAPI, Python 3.12). API 명세: [docs/api](../docs/api/README.md)

```sh
cd backend
uv sync                                   # Python 3.12 가상환경 + 의존성
uv run uvicorn app.main:app --reload      # http://localhost:8000/api/v1/docs
uv run pytest                             # 테스트
uv run black .                            # 포맷
```

구조: 계층별 폴더에 영역마다 같은 이름의 파일을 둡니다 — `api/v1/routers/` (HTTP), `schemas/` (요청 · 응답), `models/` (도메인 엔티티), `services/` (상태 · 규칙), `seeds/` (목업 데이터), `configs/`, `rpc/` (gRPC), `core/` (에러 · 이벤트 · 시각). 지금은 메모리에 목업과 같은 데이터를 두고 동작합니다.

## 목업 데이터

`app/seeds/data/*.json` 이 목업 데이터의 원본입니다 (웹은 더 이상 자체 목업을 갖지 않습니다).

## gRPC (로봇 60 Hz 스트림)

`proto/robot.proto` 의 `RobotStream` 서비스입니다. 지금은 목업 신호(웹 JointPlots 와 같은 사인파)를 보냅니다.

```sh
uv run python -m app.rpc.server            # :50051 (--port 로 변경)
```

proto 를 바꾸면 스텁을 다시 만들어 커밋합니다 (`app/rpc/gen/`, black 대상에서 제외):

```sh
uv run python -m grpc_tools.protoc -Iapp/rpc/gen=proto \
  --python_out=. --pyi_out=. --grpc_python_out=. app/rpc/gen/robot.proto
```

브라우저는 gRPC 를 직접 쓸 수 없으므로 grpc-web / Connect 로 Envoy(또는 비슷한) 프록시를 거쳐 연결합니다.
