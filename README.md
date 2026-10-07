<p align="center">
  <img src="web/public/favicon.svg" width="72" alt="Mimic logo" />
</p>

<h1 align="center">Mimic</h1>

<p align="center">사람이 시연하고 로봇이 배우는 SO-101 로봇 학습 스테이션</p>

leader 암으로 시연한 데이터를 녹화 · 검수하고, LeRobot 데이터셋으로 만들어 SmolVLA(Vision-Language-Action) 모델을 학습 · 평가하는 데까지 한 스테이션에서 이어 주는 도구입니다. 이름은 사람의 시연을 보고 따라 하는(mimic) 모방 학습에서 왔고, 로고는 leader 와 follower 두 팔이 마주 보는 모양으로 그린 "M" 입니다.

```
Rigs ─▶ Capture ─▶ Review ─▶ Convert ─▶ Datasets (─▶ Merge) ─▶ Training ─▶ Models ─▶ Evaluate / Simulation
(장치)   (MCAP)    (검수)    (LeRobot)   (HF Hub)                (SmolVLA)   (checkpoint) (실제 로봇 / Isaac Sim)
```

| 단계 | 하는 일 | 상태 |
| --- | --- | --- |
| Rigs | 포트 스캔 · 연결 테스트 · LeRobot 캘리브레이션 · 카메라 미리보기 · teleop 테스트. 고른 포트는 rig 파일에 바로 저장 | 실제 장치로 동작 |
| Capture | leader 가 follower 를 움직이는 동안 action · state(60 Hz)와 카메라(30 fps)를 에피소드마다 MCAP 하나로 녹화. 화면에 실시간 영상 · 관절 그래프 | 실제 장치로 동작 |
| Review | MCAP 을 영상 · 관절 그래프와 함께 재생하며 Accept / Reject / Delete | 동작 |
| Convert | Task 의 승인된 에피소드를 LeRobot v3.0 데이터셋으로 변환 (카메라 영상 포함, action 을 카메라 fps 로 맞춤) | 동작 |
| Datasets | LeRobot 데이터셋과 원본 MCAP 묶음 관리, 썸네일, HF Hub 업로드 · 내려받기(Pull) | 동작 |
| Merge | fps · feature · Rig 가 같은 데이터셋 여러 개를 하나로 합침 (영상 포함, 에피소드 · index 번호를 다시 매김) | 동작 |
| Training | SmolVLA 를 로컬 GPU 또는 RunPod 에서 학습, step 마다 loss · GPU 지표 확인. RunPod 은 데이터셋을 HF Hub 에 올린 뒤 pod 를 빌려 학습하고, 체크포인트를 내려받은 다음 pod 를 끔 | 로컬 GPU · RunPod 동작 |
| Models | 남길 checkpoint 를 모델로 저장 · 관리 | 목록 · 관리만 (학습기 연동 전) |
| Evaluate | 모델을 실제 로봇에 올려 지시문을 주고 성공률 기록 | 준비 중 |
| Simulation | Isaac Sim 5.1.0 (이 스테이션 또는 시뮬레이션 서버) 에서 환경 열기 · 자동 평가 | 환경 열기 동작, 평가 준비 중 |

## 저장소 구성

| 폴더 | 내용 |
| --- | --- |
| [`web/`](web/README.md) | 스테이션 UI (React + TypeScript). 모든 데이터는 백엔드에서 받음 |
| [`backend/`](backend/README.md) | FastAPI 서버. 장치는 LeRobot 으로 직접 다룸 (gRPC · WebRTC 는 예정) |
| `config/` | 스테이션 설정: rig 파일, 기본 설정, 로봇 캘리브레이션 — git 에 올림 |
| `data/` | 웹에서 만든 데이터: task, 녹화(MCAP), 데이터셋, 모델 — git 제외 |
| [`sim/`](sim/README.md) | Isaac Sim 평가 환경 폴더 |
| [`docs/api/`](docs/api/README.md) | API 명세 |
| [`docs/review/`](docs/review/README.md) | 실제 사용 전 검토 기록 (2026-10-03) |

## 시작

```sh
# 백엔드 + 웹 한 번에 (Ctrl+C 로 둘 다 종료, --install 은 uv sync · npm install 먼저 실행)
scripts/dev.sh
```

따로 띄울 때:

```sh
# 백엔드 (http://localhost:8000/api/v1/docs) — uv sync 가 LeRobot(+ torch)까지 설치
cd backend && uv sync && uv run uvicorn app.main:app --reload

# 웹 (http://localhost:5173, /api 는 백엔드로 프록시)
cd web && nvm use && npm install && npm run dev
```

### 장치 준비

1. `config/rigs/<rig>.yaml` 에 로봇 · leader · 카메라를 적습니다 (`so101-kit` 예시 포함).
2. Rigs 페이지에서 장치마다 **Change…** 로 포트를 고릅니다. 카메라는 미리보기를 보고 고릅니다. Rig 을 열면 연결 테스트가 자동으로 돕니다.
3. 팔은 **Calibrate** 로 캘리브레이션합니다. 결과는 `config/calibration/` 에 LeRobot 형식으로 저장됩니다. LeRobot CLI 를 따로 쓸 때는 `HF_LEROBOT_CALIBRATION=config/calibration` 을 지정하세요.
4. **Test teleoperation** 으로 leader → follower 동작을 확인한 뒤 Capture 로 녹화합니다.

카메라 경로는 USB 꽂은 위치 기준(`/dev/v4l/by-path`)이라, 카메라는 같은 USB 포트에 꽂아 두세요.

## 작업 규칙

- **브랜치:** `main` ← `develop` ← `feat/web` ← 작업 브랜치(`feat/web-*`, `fix/web-*`, `refactor/web-*`, `chore/*`, `docs/*`). 작업 브랜치는 `--no-ff` 로 `feat/web` 에 합칩니다.
- **커밋:** 영어 Conventional Commits — `feat(web): …`, `fix(backend): …`, `refactor: …`, `chore: …`, `docs: …`. 기능 단위로 나눕니다.
- **검사:** 커밋 전에 `cd web && npm run check`, `cd backend && uv run pytest && uv run black .`.

## 데이터 · 개인정보

- 작업자(오퍼레이터) 개념은 없습니다. 스테이션 하나는 한 사람이 수집한 데이터입니다. 실명 · 이메일 등 개인정보는 코드 · 데이터 · 커밋에 넣지 않습니다.
- 녹화 파일(MCAP), 데이터셋, checkpoint 는 `data/` 에만 두고 저장소에 올리지 않습니다. API 키(HF · RunPod · Slack)는 저장소 루트의 `.env` 에만 보관합니다 (`.gitignore` 참고).
- 환경변수 접두어는 예전 이름을 이어 `VLA_*` 를 그대로 씁니다 (`VLA_CONFIG_DIR`, `VLA_DATA_DIR` 등, `.env.example` 참고).
