# backend

스테이션 백엔드 (FastAPI, Python 3.12). API 명세: [docs/api](../docs/api/README.md)

```sh
cd backend
uv sync                                   # Python 3.12 가상환경 + 의존성
uv run uvicorn app.main:app --reload      # http://localhost:8000/api/v1/docs
uv run pytest                             # 테스트
uv run black .                            # 포맷
```

구조: 계층별 폴더에 영역마다 같은 이름의 파일을 둡니다 — `api/v1/<기능>/` (HTTP — 기능마다 패키지, 하위 리소스마다 모듈. 공용 파라미터는 `api/deps.py`), `schemas/` (요청 · 응답), `models/` (도메인 엔티티), `services/` (상태 · 규칙 — 보조 모듈이 있는 training · simulation · capture · tasks · realtime · settings · recordings · rigs 는 패키지), `seeds/` (목업 데이터), `configs/`, `rpc/` (gRPC), `core/` (에러 · 이벤트), `utils/` (시각 · 경로 · ID · 난수 공용 함수). 데이터는 모두 저장소 루트의 `data/`(`VLA_DATA_DIR` 로 변경)에 있습니다 (Storage 설정은 없음). git 에 올리는 것: `settings/<part>.yaml`(huggingface · runpod · connection · notifications — 편집 가능한 값만, `version` · 연결 상태 · API 키는 저장하지 않음), `rigs/<id>.yaml`(SO-101 Kit — robot · device · cameras · rates 를 직접 적는 형식, rig seed 가 없으므로 새 data 폴더에는 이 파일이 있어야 함). git 에서 제외: `tasks/<id>.yaml`, `recordings/<task-id>/ep_<NNNN>.mcap` + `.yaml`(목록용), `datasets/<ns>/<name>/`(실제 LeRobot v3.0 폴더, pyarrow 로 작성), `models/<id>/`. API 키 원문은 저장소 루트 `.env` 에 둡니다. 파일을 직접 고친 뒤 재시작하면 반영됩니다.

## `.env` (API 키 · 환경 변수)

API 키 원문은 저장소 루트의 `.env` 에 둡니다 (git 에서 제외, 권한 600). 실행 위치와 상관없이 루트의 `.env` 를 읽습니다. 처음에는 `cp .env.example .env` 로 만들고 값을 채우거나, 웹 Settings 에서 키를 입력하면 백엔드가 해당 줄만 고쳐 씁니다 (다른 줄 · 주석은 그대로).

| 키 | 용도 |
| --- | --- |
| `HF_TOKEN` | Hugging Face 업로드 (huggingface_hub 도 그대로 사용) |
| `RUNPOD_API_KEY` | RunPod 학습 |
| `SLACK_WEBHOOK_URL` | Slack 알림 |
| `VLA_DATA_DIR` · `VLA_SIM_ENVS_DIR` · `VLA_TIMEZONE` … | 백엔드 설정 (`app/configs/config.py`, 상대 경로는 저장소 루트 기준) |

같은 이름의 환경 변수가 있으면 `.env` 보다 우선합니다. API 응답에는 끝 4자리만 나갑니다. 예전 `data/secrets.yaml` 이 있으면 시작할 때 `.env` 로 옮기고(이미 있는 키는 유지) 지웁니다. 테스트는 임시 `.env` 만 씁니다.

## 목업 데이터

더미 데이터는 없습니다. 스테이션은 빈 상태로 시작하고 모든 목록은 `data/` 아래 파일에서 읽습니다. `app/seeds/data/*.json` 에는 기본값(설정 기본값, 단축키, 학습 옵션)만 남아 있습니다. Rigs 페이지의 포트 스캔 · 연결 테스트 · 암 캘리브레이션은 LeRobot 으로 실제 장치에 접근합니다(`uv sync` 의 기본 `hardware` 그룹, 연결 테스트 전까지 장치는 "off"). 스트리밍 드라이버 · 카메라 파이프라인 · 학습기 · 시뮬레이션/평가 실행기는 아직 없어서 학습 · 평가 · 시뮬레이션 시작은 503 을 돌려줍니다.

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
