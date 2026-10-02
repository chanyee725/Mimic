# VLA Data Pipeline

SO-101 로봇 팔의 텔레오퍼레이션 데이터를 모아 VLA(Vision-Language-Action) 모델 학습까지 이어 주는 스테이션 도구.

```
Capture ─▶ Review ─▶ Convert ─▶ Datasets ─▶ Training ─▶ Models ─▶ Evaluate / Simulation
 (MCAP)    (검수)    (LeRobot)   (HF Hub)    (SmolVLA)   (checkpoint)  (실제 로봇 / Isaac Sim)
```

| 단계 | 하는 일 |
| --- | --- |
| Capture | leader 암으로 시연하며 카메라 30 fps · action 60 Hz 를 에피소드마다 MCAP 파일로 녹화 |
| Review | 저장한 MCAP 을 재생하며 Accept / Reject / Delete |
| Convert | Task 의 승인된 에피소드를 LeRobot v3.0 데이터셋으로 변환 (action 을 카메라 fps 로 맞춤) |
| Datasets | LeRobot 데이터셋과 원본 MCAP 묶음을 보고 HF Hub 에 올림 |
| Training | SmolVLA 를 로컬 GPU 또는 RunPod 에서 학습, step 마다 loss · GPU 지표 확인 |
| Models | 남길 checkpoint 를 모델로 저장 · 관리 |
| Evaluate | 모델을 실제 로봇에 올려 지시문을 주고 성공률 기록 |
| Simulation | Isaac Sim(로컬 RTX 4090) 에서 자동 평가 — 준비 중 |

## 저장소 구성

| 폴더 | 내용 | 상태 |
| --- | --- | --- |
| [`web/`](web/README.md) | 스테이션 UI (React + TypeScript) | 목업 데이터로 동작 |
| `backend/` | FastAPI(REST) · gRPC(로봇 데이터) · WebRTC(카메라) 서버 | 예정 |

## 시작

```sh
cd web
nvm use          # Node 24
npm install
npm run dev      # http://localhost:5173
```

## 작업 규칙

- **브랜치:** `main` ← `develop` ← `feat/web` ← 작업 브랜치(`feat/web-*`, `fix/web-*`, `refactor/web-*`, `chore/*`). 작업 브랜치는 `--no-ff` 로 `feat/web` 에 합친다.
- **커밋:** 영어 Conventional Commits — `feat(web): …`, `fix(web): …`, `refactor(web): …`, `chore(web): …`, `docs: …`. 기능 단위로 나눈다.
- **검사:** 커밋 전에 `cd web && npm run check` (typecheck + lint + format).

## 데이터 · 개인정보

- 작업자는 가명 ID(`OP-01` 형식)로만 기록한다. 실명 · 이메일 등 개인정보는 코드 · 데이터 · 커밋에 넣지 않는다.
- 녹화 파일(MCAP), 데이터셋, checkpoint, API 키(HF · RunPod · W&B · Slack)는 저장소에 올리지 않는다 (`.gitignore` 참고). 키는 백엔드에만 보관한다.
