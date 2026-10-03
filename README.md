# VLA Data Pipeline

SO-101 로봇 팔의 텔레오퍼레이션 데이터를 모아 VLA(Vision-Language-Action) 모델 학습까지 이어 주는 스테이션 도구.

```
Capture ─▶ Review ─▶ Convert ─▶ Datasets (─▶ Merge) ─▶ Training ─▶ Models ─▶ Simulation / Evaluate
 (MCAP)    (검수)    (LeRobot)   (HF Hub)    (SmolVLA)   (checkpoint)  (실제 로봇 / Isaac Sim)
```

| 단계 | 하는 일 |
| --- | --- |
| Capture | leader 암으로 시연하며 카메라 30 fps · action 60 Hz 를 에피소드마다 MCAP 파일로 녹화 |
| Review | 저장한 MCAP 을 재생하며 Accept / Reject / Delete |
| Convert | Task 의 승인된 에피소드를 LeRobot v3.0 데이터셋으로 변환 (action 을 카메라 fps 로 맞춤) |
| Datasets | LeRobot 데이터셋과 원본 MCAP 묶음을 보고 HF Hub 에 올림 |
| Merge | fps · feature · Rig 가 같은 LeRobot 데이터셋 여러 개를 하나로 합침 (에피소드 · index 번호를 다시 매김) |
| Training | SmolVLA 를 로컬 GPU 또는 RunPod 에서 학습, step 마다 loss · GPU 지표 확인 |
| Models | 남길 checkpoint 를 모델로 저장 · 관리 |
| Evaluate | 모델을 실제 로봇에 올려 지시문을 주고 성공률 기록 |
| Simulation | Isaac Sim(로컬 RTX 4090) 에서 자동 평가 — 준비 중 |

## 저장소 구성

| 폴더 | 내용 | 상태 |
| --- | --- | --- |
| [`web/`](web/README.md) | 스테이션 UI (React + TypeScript) | 백엔드에 연결됨 |
| [`backend/`](backend/README.md) | FastAPI(REST) · gRPC(로봇 데이터) · WebRTC(카메라) 서버 | `data/` 의 실제 파일로 동작, 더미 없음 (장치 드라이버 · 학습기 · 실행기 연동 전) |
| [`sim/`](sim/README.md) | Isaac Sim 평가 환경 폴더 | 예제 환경 |
| [`docs/api/`](docs/api/README.md) | API 명세 | |
| [`docs/review/`](docs/review/README.md) | 실제 사용 전 검토 (부족한 것 · UI 버그 · API 문서 불일치 · RunPod) | 2026-10-03 |

## 시작

```sh
# 백엔드 (http://localhost:8000/api/v1/docs)
cd backend && uv sync && uv run uvicorn app.main:app --reload

# 웹 (http://localhost:5173, /api 는 백엔드로 프록시)
cd web && nvm use && npm install && npm run dev
```

## 작업 규칙

- **브랜치:** `main` ← `develop` ← `feat/web` ← 작업 브랜치(`feat/web-*`, `fix/web-*`, `refactor/web-*`, `chore/*`). 작업 브랜치는 `--no-ff` 로 `feat/web` 에 합친다.
- **커밋:** 영어 Conventional Commits — `feat(web): …`, `fix(web): …`, `refactor(web): …`, `chore(web): …`, `docs: …`. 기능 단위로 나눈다.
- **검사:** 커밋 전에 `cd web && npm run check` (typecheck + lint + format).

## 데이터 · 개인정보

- 작업자는 가명 ID(`OP-01` 형식)로만 기록한다. 실명 · 이메일 등 개인정보는 코드 · 데이터 · 커밋에 넣지 않는다.
- 녹화 파일(MCAP), 데이터셋, checkpoint, API 키(HF · RunPod · Slack)는 저장소에 올리지 않는다 (`.gitignore` 참고). 키는 백엔드에만 보관한다.
