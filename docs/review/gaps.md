# 필요한 것 / 부족한 것

경로는 `backend/app/` 기준입니다. 통신 테스트 · 데이터 취득은 나중에 할 일이라, 아래 P0 중 1–3은 그 단계에서 함께 진행하면 됩니다.

## P0 — 실제 수집 · 학습 전에 꼭 필요

### 1. 로봇 드라이버 (leader · follower)
- 장치 상태를 바꾸는 hook은 `services/rigs/rigs.py` `set_device_state()` 하나뿐이고, 지금은 테스트만 호출합니다.
- 그래서 모든 장치가 `health=off`이고 Capture start(`services/capture/session.py`), gRPC 스트림, Calibrate, Evaluate가 모두 503입니다. 지금 단계에서는 의도한 동작입니다.
- 필요한 것: 장치 연결 · 끊김 감지, leader → follower 60 Hz 루프, 캘리브레이션 결과 저장(`finish_calibration`은 placeholder).
- 관절 단위(degrees인지 LeRobot의 -100..100 범위인지)는 LeRobot `so101_follower`에 맞춰야 합니다 (미확인).

### 2. 녹화 내용이 가짜 신호
- `services/recordings/mcap_io.py` `encode()`가 action · state를 `mock_robot.sample()`로 합성합니다. 지금은 장치가 off라 Capture가 막혀 있어 실제로는 실행되지 않습니다.
- 드라이버를 붙일 때 `services/capture/recording.py` `build_episode`를 실제 샘플 버퍼로 바꿔야 합니다.
- 지금은 에피소드 전체를 메모리(`BytesIO`)에 모았다가 저장할 때 한 번에 씁니다. 영상이 들어가면 GB 단위가 되므로 **녹화하면서 디스크에 쓰는 MCAP writer**가 필요합니다 (크래시가 나도 파일이 남게).

### 3. 카메라 파이프라인
- WebRTC는 501(`services/realtime` `create_session`), MCAP 채널은 `/action`, `/observation/state`, `/subtask`뿐입니다.
- 필요한 것: 캡처 → 미리보기(WebRTC) → MCAP 영상 채널(예: foxglove `CompressedVideo` / `CompressedImage`) → 타임스탬프 정렬.

### 4. LeRobot 데이터셋에 영상 없음
- `services/datasets/lerobot.py`는 영상을 쓰지 않습니다. SmolVLA는 `observation.images.*`가 필요해서 지금 데이터셋으로는 학습이 실패할 가능성이 높습니다 (LeRobot 검증 로직은 미확인).
- 필요한 것: `videos/<key>/chunk-*/file-*.mp4` 인코딩, `info.json`의 video feature, 영상 통계.
- 실제 `lerobot.datasets.LeRobotDataset`로 로드되는지 확인하는 테스트가 없습니다 (지금은 pyarrow로 직접 쓰고, `lerobot`은 의존성에 없음).

### 5. 학습 실행기
- `services/training/jobs.py` `create_job`은 무조건 503입니다.
- 명령 미리보기(`services/training/config.py`)에 빠진 인자: `--output_dir`, `--job_name`, `--dataset.root=data/datasets/<ns>/<name>`, `--policy.push_to_hub=false`(또는 `--policy.repo_id`).
- 로컬 subprocess 관리, 로그를 파싱해 `training.metrics` 이벤트로 보내기, 체크포인트를 Models로 옮기기가 필요합니다.

### 6. "Push"가 업로드 없이 성공으로 기록됨 (데이터 무결성)
- `services/datasets/datasets.py` push: 업로드 없이 `hub.pushed=True`를 sidecar에 저장.
- `services/models.py` push: `hub_repo`만 기록하고 `private`는 무시.
- `services/training/jobs.py` 체크포인트 push도 같음.
- 결과적으로 UI가 Hub에 없는 데이터를 있다고 보여 줍니다. huggingface_hub 연동 전까지는 **501/503**을 돌려주도록 바꿔야 합니다.

### 7. gRPC 서버가 별도 프로세스
- `app/rpc/server.py`는 `python -m app.rpc.server`로 따로 실행되고 FastAPI lifespan에서 띄우지 않습니다 (실측: 50051 포트 닫혀 있음).
- 장치 상태가 프로세스 메모리에 있어, 드라이버가 FastAPI 쪽에 붙으면 gRPC 프로세스는 그 상태를 볼 수 없습니다. 같은 프로세스로 합칠지, 공유 상태를 둘지 정해야 합니다.

### 8. 학습 job · Pod ID가 메모리에만 있음
- `services/training/jobs.py` — RunPod 연동 후 재시작하면 Pod를 잃어 **과금이 계속**됩니다. job과 Pod ID를 디스크에 저장하고, 시작할 때 이름 prefix로 고아 Pod를 정리해야 합니다.

## 재시작하면 사라지는 상태

| 상태 | 위치 | 영향 |
| --- | --- | --- |
| Capture 세션 (진행 중 에피소드, 발급한 번호) | `services/capture/session.py` | 녹화 도중 재시작하면 데이터 손실 (P0, 실제 녹화 시) |
| 학습 job · RunPod Pod ID | `services/training/jobs.py` | Pod를 잃어 과금 계속 (P0, RunPod 연동 시) |
| Sim job · 에피소드 | `services/simulation/jobs.py` | 평가 결과 손실 (P1) |
| Evaluate run | `services/evaluate.py` | 판정 전 run 손실, 판정된 시도는 `model.yaml`에 남음 (P2) |
| 실패한 데이터셋 job | `services/datasets/datasets.py` | `failed` 상태 · 오류 메시지가 메모리에만 있음 (P2) |
| 장치 상태 · 캘리브레이션 진행 | `services/rigs/rigs.py` | 드라이버가 다시 보고하면 됨. 캘리브레이션 결과 저장 위치는 정해야 함 (P1) |
| Settings 실시간 값 (`spentThisMonth`, `latencyMs`) | `services/settings/settings.py` | 설계상 의도 |

## P1

- **RunPod 연동 전체** — [runpod.md](runpod.md).
- **HF Hub 클라이언트** — 업로드, `whoami`로 토큰 검증(지금은 "Key is set (not verified online)"), private repo 처리.
- **Isaac Sim · Evaluate 실행기** — `services/simulation/jobs.py`, `services/evaluate.py`는 503. 정책 추론 서버(SmolVLA를 로컬 GPU에 올리기), rollout 영상(501) 필요.
- **알림** — Slack 전송 코드가 없습니다. 이벤트 토글만 저장되고, RunPod `monthly_budget` · `idle_alert_min`도 쓰이지 않습니다.
- **로깅** — uvicorn 앱용 logging 설정이 없어 `log.info`가 나오지 않고 파일 로그도 없습니다. 녹화 · 변환 · 학습 job별 로그 파일이 필요합니다.
- **오류 처리** — 처리되지 않은 예외가 평문 500으로 나갑니다(`core/errors.py`에 catch-all 없음). 웹에는 ErrorBoundary가 없어 렌더 예외 하나로 앱 전체가 흰 화면이 됩니다 (병합 중 Settings에서 실제로 발생, 지금은 수정됨).
- **쓰기 내구성** — `core/storage.py` `write_file`이 `fsync` 없이 `os.replace`만 합니다. 정전 시 MCAP · sidecar가 0바이트로 남을 수 있습니다.
- **operator 기록** — operator가 MCAP metadata에만 있어 Sessions의 operator가 항상 null입니다. 웹은 `X-Operator` 헤더를 보내지 않고, 정규식도 영역마다 다릅니다 ([api-docs.md](api-docs.md) B4).

## P2

- **백업** — 녹화 · 데이터셋 백업, 외장 디스크 · NAS 동기화, 디스크 부족 경고 없음 (Dashboard 경고는 90 % 초과 시에만).
- **인증** — 없음(CORS만). gRPC가 `[::]`에 insecure로 bind(`rpc/server.py`) — 다른 머신에 노출하기 전에 localhost bind나 토큰 필요.
- **임시 폴더** — 크래시 뒤 `.<name>.partial-*` 폴더를 시작할 때 지우지 않아 디스크가 샙니다.
- **미구현** — 데이터셋 썸네일, 모델 · 체크포인트 다운로드, 녹화 영상 추출이 501.
- **테스트 공백** — LeRobot 로더 호환성, 대용량 MCAP 스트리밍 쓰기, 재시작 뒤 job 복구.
