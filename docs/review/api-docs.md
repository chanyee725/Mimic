# API 문서 · 구현 불일치

OpenAPI의 93개 operation과 `docs/api/*.md`의 경로는 모두 일치합니다 (문서에 없는 것은 `GET /health` 하나).
빈 상태의 목록 · Page · 오류 본문 모양도 문서와 같습니다.

## 실제 버그

| # | 문서 | 구현 | 차이 |
| --- | --- | --- | --- |
| B1 | `realtime.md` (topics `tasks`, `settings`) | `backend/app/services/realtime/topics.py` `PREFIX_TOPICS`에 `task`, `settings` 없음 | **Task · Settings 이벤트가 WS로 나가지 않음** (확인함). 실측 hello에 `ignored:["settings","tasks"]`. 웹 `api/events.ts`의 캐시 갱신이 동작하지 않아, 다른 탭에서 바꾼 Task · Settings가 새로고침 전까지 안 보임 |
| B4 | `tasks.md` (`OP-\d{2}`) / `capture.md` (`OP-\d{2,}`) | `schemas/tasks.py`, `schemas/capture.py` | operator 정규식이 영역마다 다름. 웹은 `X-Operator`를 보내지 않아 `updatedBy`가 항상 `OP-01` |

(검토 중 보고된 B2 웹 Storage 섹션 잔존, D12 `spentThisMonth` nullable 문제는 병합 후 확인해 보니 이미 해결되어 있습니다.)

## OpenAPI 계약 문제

- **O1** — 422 스키마가 FastAPI 기본 `{detail:[…]}`로 선언돼 있지만 실제 본문은 `{"error":{code,message,details}}` (`core/errors.py`).
- **O2** — 404 · 409 · 424 · 501 · 503이 OpenAPI에 선언되어 있지 않음. 공통 `ErrorBody`와 `responses=`가 필요.
- **O3** — 기본값이 있어 항상 오는 필드가 optional로 나옴 (예: `TrainJob.checkpoints`, `Model.evals`, `SimJob.done`).
- **O4** — `/tasks/{id}/yaml`, `/rigs/{id}/yaml`이 JSON으로 선언됐지만 실제는 `text/yaml`. `POST /tasks/import`에 requestBody 선언 없음.
- **O5** — 500이 평문. `conventions.md`의 "모든 non-2xx가 같은 본문"과 다름.

## 문서가 구현보다 오래됨

| # | 문서 | 실제 |
| --- | --- | --- |
| D1 | `capture.md`: `/cam_<key>/image`, `/labels/*` 토픽 | 채널은 `/action`, `/observation/state`, `/subtask`뿐, outcome은 metadata (`recordings.md`가 맞음) |
| D2 | `recordings.md`: Settings `storage.rawPath` | `<data_dir>/recordings` 고정 |
| D3 | `recordings.md`: "mock signal" | 여전히 사실 — 드라이버 연동 시 수정 |
| D5 | `capture.md`: `use-episode.ts` | 실제는 `features/capture/hooks/use-capture.ts` |
| D6 | `station.md`: `api/devices.ts#getStationWarnings` | 실제는 `web/src/api/station.ts` |
| D7 | `training.md`: 웹 상수 `LOCAL_GPUS`, `RUNPOD_*` | 웹에 없음 |
| D8 | `conventions.md`, `realtime.md`: gRPC `:50051` | 별도 프로세스, lifespan에서 띄우지 않음. 실행 안내 없음 |
| D9 | `realtime.md`: `training.metrics`, `sim.episode`, `station.warnings` | publish 0건. `station.warnings`는 지금도 계산 가능 |
| D10 | `datasets.md`, `models.md`: push 202 | 업로드 없이 pushed로 기록 ([gaps.md](gaps.md) P0-6). models push는 이벤트도 없음 |
| D11 | `training.md`: malformed body면 422, 아니면 503 | 의미 검증 없이 바로 503. `/sim/jobs`는 검증(422) 뒤 503이라 일관성 없음 |
