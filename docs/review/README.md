# 스테이션 검토 (2026-10-03)

더미 데이터를 지운 빈 스테이션(`feat/web` @ `13c5a9f`)을 기준으로 실제 사용 전에 필요한 것, UI 문제, API 문서 불일치, RunPod 정의를 검토했습니다.
통신 테스트와 실제 데이터 취득은 이번 범위가 아니라서, 그쪽 항목은 "나중에 할 일"로만 적었습니다.

| 문서 | 내용 |
| --- | --- |
| [gaps.md](gaps.md) | 필요한 것 / 부족한 것 (P0 · P1 · P2), 재시작하면 사라지는 상태 |
| [ui.md](ui.md) | UI 버그 · UX 문제 (1440×900, 1280×720 headless 검사) |
| [api-docs.md](api-docs.md) | API 문서(`docs/api`)와 구현이 다른 곳, OpenAPI 계약 문제 |
| [runpod.md](runpod.md) | RunPod 정의를 공식 문서와 비교한 결과, 고친 모델, 학습 실행 흐름 |

## 검토 방법

- 백엔드 테스트 290개 통과(임시 `VLA_DATA_DIR` · `.env` 사용), 웹 `npm run check` 통과.
- 모든 페이지를 headless Chrome으로 빈 상태에서 열어 봄. 서버에는 GET만 보냄.
- RunPod는 공식 OpenAPI(`rest.runpod.io/v1/openapi.json`, `api.runpod.io/v2/openapi.json`)와 docs.runpod.io를 직접 받아 비교.
- "미확인"은 코드로만 추정했거나 데이터 · 하드웨어가 없어 직접 보지 못한 것입니다.

## 우선순위 요약

### P0 — 실제 수집 · 학습 전에 꼭 필요

1. 로봇 드라이버 (leader → follower 60 Hz 루프, 연결 감지, 캘리브레이션 저장)
2. 녹화하면서 디스크에 쓰는 MCAP writer, 가짜 신호(`mock_robot`) 제거
3. 카메라 파이프라인 (WebRTC 미리보기, MCAP 영상 채널, LeRobot `videos/`)
4. HF "Push"가 실제 업로드 없이 성공으로 기록되는 문제 → 연동 전까지 501
5. 학습 실행기 (로컬 subprocess, 로그 → `training.metrics`, 체크포인트 → Models), 명령 인자 보완
6. gRPC 서버 프로세스 구조 결정 (지금은 별도 프로세스, 장치 상태 공유 불가)
7. 학습 job · RunPod Pod ID 디스크 저장 (재시작하면 Pod를 잃고 과금이 계속됨)
8. **WS `tasks` · `settings` 토픽 버그** — 이 이벤트가 웹으로 나가지 않음 (확인됨, [api-docs.md](api-docs.md) B1)

### P1

- RunPod REST **v2** 클라이언트 — v1은 **2026-11-15 폐기 예정** (공식 문서 기준)
- HF Hub 클라이언트 (업로드, `whoami`로 토큰 검증)
- Isaac Sim · Evaluate 실행기, 정책 추론 서버
- 웹 ErrorBoundary(`errorElement`), 백엔드 catch-all 500 핸들러, 앱 로깅
- 저장 시 `fsync`, sidecar에 operator 기록
- 실행기 미연결을 버튼을 누르기 전에 알려 주기, 정적 RunPod 값을 실시간처럼 보이는 문제, invalid 환경이 Compatible로 보이는 문제, Dashboard Success 0%

### P2

- 백업 · 디스크 경고, gRPC bind · 인증, `.partial-*` 폴더 정리
- 문서 갱신과 OpenAPI 오류 응답 선언
- 빈 상태 문구와 이동 버튼 통일
