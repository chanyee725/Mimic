# UI 버그 · UX 문제

빈 상태에서 모든 경로를 headless Chrome으로 1440×900과 1280×720에서 열었습니다. 가로 overflow는 없었고, 일반 경로에서 콘솔 오류도 없었습니다.
데이터(Task · 녹화 · 데이터셋 · 모델)가 있는 화면과, Test · Calibrate · Import · Start를 눌렀을 때의 오류 표시는 확인하지 못했습니다.
경로는 `web/src/` 기준입니다.

## 공통

- **[P1] ErrorBoundary 없음** — 렌더 예외 하나로 사이드바까지 흰 화면이 됩니다 (병합 중 `formatUsd(null)`로 실제 발생, 지금은 수정됨). `app/routes.tsx`에 `errorElement`를 추가해야 합니다.
- **[P1] 실행기가 없다는 걸 미리 알려 주지 않음** — Training · Simulation · Evaluate에서 GPU가 초록 "Free"로 보이고 Start가 활성입니다. 확인 다이얼로그를 지나야 503을 받습니다. 서버가 `runner.connected` 같은 상태를 주고, 버튼 근처에 한국어 안내를 두는 게 좋습니다.
- **[P2] 없는 job 주소가 안내 없이 목록으로 돌아감** — `features/training/job-page.tsx`, `features/simulation/job-page.tsx`.
- **[P2] 빈 목록 문구가 필터 결과처럼 읽힘** — 데이터가 0건인데 "일치하는 …이 없습니다"가 나오고 오른쪽 패널 문구와 겹칩니다: `datasets/components/dataset-list.tsx`, `models/components/model-list.tsx`, `merge/components/source-list.tsx`, `simulation/components/env-list.tsx`.
- **[P2] 빈 상태 이동 버튼이 페이지마다 다름** — Capture · Datasets · Merge에는 있고 Review · Convert · Evaluate · Models · Training에는 없습니다.
- **[P2] import 순서 규칙 위반 33곳** — `@/components/common/query-state`가 상대 import 뒤에 있음 (예: `capture/page.tsx`, `convert/page.tsx`).

## 페이지별

| 페이지 | 문제 | 위치 |
| --- | --- | --- |
| Dashboard | **[P1]** 데이터 0건인데 Success rate가 "0%". "—"여야 함 | `backend/app/services/station.py` |
| Dashboard | [P2] Storage KPI가 녹화 · 데이터셋이 아니라 data 폴더 전체 크기 | 같은 파일 |
| Dashboard | [P2] heatmap 요일 · 월 라벨이 약 6px | `dashboard/components/episode-heatmap.tsx` |
| Rigs | **[P1]** 설명은 "등록하고 관리합니다"인데 Add rig · Add device가 항상 비활성이고 이유는 tooltip에만 있음 | `rigs/page.tsx`, `rigs/components/rig-list.tsx` |
| Rigs | [P2] "Rescan ports"가 실제로는 다시 불러오기만 함 | `rigs/page.tsx` |
| Rigs | [P2] 상태가 원시 값 `off`로 보이고 Calibration 칸에 "Not connected" | `rigs/components/device-detail.tsx` |
| Tasks | [P2] 설명에 안내되지 않은 "Sessions" 언급 | `tasks/page.tsx` |
| Tasks | [P2] "No tasks found."가 영어 (안내 문구는 한국어 규칙) | `tasks/components/task-list.tsx` |
| Tasks | [P2] "SO-101" Badge가 하드코딩된 pill | `tasks/components/task-detail.tsx` |
| Capture | [P2] description이 영어 문장 | `capture/page.tsx` |
| Review | [P2] Task가 없어도 Import MCAP이 활성, 어디에 보이는지 안내 없음 | `review/page.tsx` |
| Settings › About | [P2] "lerobot: not installed"가 변환 불가로 오해됨 (변환은 pyarrow만 씀) | |
| Merge | [P2] "Sources 0 of 0"과 비활성 "Merge 0 datasets" | `merge/components/merge-output.tsx` |
| Merge | [P2] placeholder `local/my_dataset_merged`가 HF namespace와 무관 | 같은 파일 |
| Training | **[P1]** RunPod 탭이 API 키 없이도 정적 가격 · "19 GPUs" · "up to $11.34"를 실시간처럼 보여 줌 | `training/components/start-training.tsx`, `runpod-dialog.tsx` |
| Training | [P2] 1280×720에서 RunPod를 고르면 Parameters가 패널 안 스크롤로 밀려남 | |
| Simulation | **[P1]** 모델을 고르기 전에는 invalid 환경(`pour-into-cup`, success.py 없음)도 "Compatible" | `simulation/new-eval.ts` (spec이 없으면 issues가 빔) |
| Simulation | [P2] 없는 taskId가 Task 이름처럼 표시 | `simulation/components/env-picker.tsx` |
| Simulation | [P2] 1280×720에서 이중 스크롤로 입력칸이 가려짐 | env 목록 `max-h-80` |
| Simulation | [P2] 설명에 "RTX 4090" 하드코딩 (실제 감지 GPU와 다를 수 있음) | `simulation/page.tsx` |
| Simulation › Environments | [P2] 저장소 예제 환경 7개(1KB stub USD)가 "Ready"로 보임. 4개는 없는 taskId를 가리킴 | `sim/envs/*` |
| Simulation › Environments | [P2] Registered가 Updated보다 늦음 (스캔 시각으로 보임, 미확인) | `backend/app/services/simulation/scanner.py` |
| Evaluate | **[P1]** 로봇 미연결 사전 안내 없음 (코드로만 확인) | |
| Settings › Integrations | **[P1]** "Default network volume: vla-datasets (200 GB, EU-RO-1)"는 존재하지 않는 정적 값 | `data/settings/runpod.yaml`, `backend/app/seeds/data/training.json` |
| Settings › Integrations | [P2] Namespace 기본값 `vla-lab`이 실제 계정처럼 보임 | |
| Settings › Connection | [P2] gRPC · Video Test는 지금 항상 실패 (서버 없음, 미확인) | |
| Settings › Notifications | [P2] webhook이 없어 비활성인데 켜진 모양 그대로 회색. Slack 전송 구현도 없음 | |
| Settings › About | [P2] "0.00 GB"와 "232 GB"처럼 정밀도가 섞임 | |
