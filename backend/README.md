# backend

스테이션 백엔드 (FastAPI, Python 3.12). API 명세: [docs/api](../docs/api/README.md)

```sh
cd backend
uv sync                                   # Python 3.12 가상환경 + 의존성
uv run uvicorn app.main:app --reload      # http://localhost:8000/api/v1/docs
uv run pytest                             # 테스트
uv run black .                            # 포맷
```

구조: 계층별 폴더에 영역마다 같은 이름의 파일을 둡니다 — `api/v1/<기능>/` (HTTP — 기능마다 패키지, 하위 리소스마다 모듈. 공용 파라미터는 `api/deps.py`), `schemas/` (요청 · 응답), `models/` (도메인 엔티티), `services/` (상태 · 규칙 — 보조 모듈이 있는 training · simulation · capture · tasks · realtime 은 패키지), `seeds/` (목업 데이터), `configs/`, `rpc/` (gRPC), `core/` (에러 · 이벤트), `utils/` (시각 · 경로 · ID · 난수 공용 함수). 설정 데이터는 저장소 루트의 `data/`(`VLA_DATA_DIR` 로 변경)에 YAML 로 저장하고 git 에 올립니다 — `settings/<part>.yaml`(huggingface · runpod · wandb · storage · connection · notifications, 편집 가능한 값만 — `version` · 연결 상태 · API 키는 저장하지 않음), `rigs/<id>.yaml`(SO-101 Kit). 영상 · 녹화 데이터(`data/recordings/`, `data/videos/`)는 git 에서 제외합니다. 파일이 없으면 처음 한 번 목업(`app/seeds/data`)으로 만들고, 그다음부터는 파일을 읽습니다. 파일을 직접 고친 뒤 재시작하면 반영됩니다. 나머지(Task, 장치, 녹화, 데이터셋, 학습, 모델, 시뮬레이션 job)는 아직 메모리 목업입니다.

## `.env` (API 키 · 환경 변수)

API 키 원문은 저장소 루트의 `.env` 에 둡니다 (git 에서 제외, 권한 600). 실행 위치와 상관없이 루트의 `.env` 를 읽습니다. 처음에는 `cp .env.example .env` 로 만들고 값을 채우거나, 웹 Settings 에서 키를 입력하면 백엔드가 해당 줄만 고쳐 씁니다 (다른 줄 · 주석은 그대로).

| 키 | 용도 |
| --- | --- |
| `HF_TOKEN` | Hugging Face 업로드 (huggingface_hub 도 그대로 사용) |
| `RUNPOD_API_KEY` | RunPod 학습 |
| `WANDB_API_KEY` | Weights & Biases 로깅 |
| `SLACK_WEBHOOK_URL` | Slack 알림 |
| `VLA_DATA_DIR` · `VLA_SIM_ENVS_DIR` · `VLA_TIMEZONE` … | 백엔드 설정 (`app/configs/config.py`, 상대 경로는 저장소 루트 기준) |

같은 이름의 환경 변수가 있으면 `.env` 보다 우선합니다. API 응답에는 끝 4자리만 나갑니다. 예전 `data/secrets.yaml` 이 있으면 시작할 때 `.env` 로 옮기고(이미 있는 키는 유지) 지웁니다. 테스트는 임시 `.env` 만 씁니다.

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
