# CLAUDE.md

이 저장소에서 작업할 때 지킬 것. 사용자와는 한국어로 대화하고, 코드 주석도 한국어로 쓴다. 커밋 메시지 · 식별자는 영어.

## 프로젝트

- SO-101 텔레오퍼레이션 데이터 수집 → 검수 → LeRobot 변환 → 학습 → 평가 스테이션. 흐름은 [README.md](README.md) 참고.
- 녹화: 카메라 30 fps, action 60 Hz (leader → follower). 원본은 에피소드당 MCAP 파일 하나.
- 변환: LeRobot v3.0 만. 데이터셋 fps 는 카메라 fps 에 맞추고 action 은 다운샘플한다 (Time alignment 선택지는 두지 않는다).
- 모델: SmolVLA (`lerobot/smolvla_base`) 하나. 학습은 로컬 GPU 또는 RunPod.
- 시뮬레이션: Isaac Sim, 로컬 RTX 4090 에서 평가만 (데이터 생성 · RunPod 은 범위 밖).
- 백엔드(예정): FastAPI(REST), gRPC(60 Hz 로봇 데이터), WebRTC(카메라). 지금 프론트는 `web/src/dummy` 목업으로 동작한다.
- 향후 데이터 글러브(촉각 · flex · IMU)를 붙일 예정이지만 지금 화면에는 넣지 않는다.

## 개인정보

- 작업자는 가명 ID(`OP-01`)로만 다룬다. 실명 · 이메일 · 계정명 같은 개인정보를 코드, 목업 데이터, 커밋, 문서에 넣지 않는다.
- API 키 · 토큰은 화면에 끝 4자리만 보이고 백엔드에만 저장한다. 브라우저 저장소(localStorage 등)에 넣지 않는다.

## Git

- 브랜치: `main` ← `develop` ← `feat/web` ← 작업 브랜치 (`feat/web-*`, `fix/web-*`, `refactor/web-*`, `chore/*`).
- 작업마다 `feat/web` 에서 새 브랜치를 만들고, 끝나면 `git merge --no-ff` 로 `feat/web` 에 합친다.
- **`develop` · `main` 에 합치거나 push 하는 것은 사용자가 요청할 때만.**
- 커밋은 영어 Conventional Commits, 기능 단위로 나눈다. 메시지 끝에 `Co-Authored-By:` 줄을 붙인다.
- `git stash` · `git reset --mixed` 는 피한다 (아래 Vite 참고).

## web/ 명령

```sh
cd web
export PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH   # Node 24
npm run dev          # 5173 포트
npm run check        # typecheck + oxlint + prettier --check — 커밋 전에 항상
npm run format       # prettier --write src
```

- 코드 스타일: 세미콜론 없음, 큰따옴표, 한 줄 140자 (`.prettierrc`). `src/components/ui` 는 포맷 대상에서 뺀다.
- **Vite 캐시 문제:** 브랜치 전환 · merge · 파일을 한꺼번에 고친 뒤 dev 서버가 옛 모듈을 내보내 화면이 하얗게 되는 일이 잦다 ("does not provide an export named …"). 그럴 땐 `find src -type f -exec touch {} +` 후 다시 확인하고, 그래도 안 되면 dev 서버를 다시 띄운다.
- 보고 전에 모든 페이지를 headless 브라우저로 열어 콘솔 에러가 없는지 확인한다.

## web/ 구조와 규칙

```
src/
  app/                 routes.tsx, nav.ts, layout.tsx
  features/<name>/     page.tsx (XxxPage, 조립만) · components/ · hooks/use-*.ts · lib.ts (헬퍼 · 상태→색 맵 · 상수 · 로컬 타입)
  components/ui/       shadcn CLI 전용 — 직접 고치지 않는다 (테마는 index.css 토큰, 동작은 app/ 래퍼로)
  components/app/      여러 기능이 쓰는 컴포넌트: Page/Panel, StatusDot, StatStrip, Segmented, SearchInput,
                       EmptyState, ProgressBar, DetailList, ProgressRing, HfBadge, TaskPicker, SettingsSection …
  components/robot/    VideoTile, JointPlots, plot-canvas.ts (캔버스 그리기 함수)
  hooks/               use-hotkeys, use-draft-on-open, use-mobile
  lib/                 utils(cn), format(시간 · 크기 · 요금 · 복수형), recordings-store
  dummy/               목업 데이터와 (지금은) 도메인 타입
```

- named export 만 쓴다. feature 안에서는 `./` 상대 경로, 다른 feature 를 import 하지 않는다 (두 곳 이상 쓰면 `components/app` · `lib` 로 올린다).
- import 순서: 외부 → `@/components/ui` → `@/components/app` · `robot` → `@/dummy` → `@/hooks` → `@/lib` → `./`.
- 새 코드를 쓰기 전에 위 공용 컴포넌트 · `lib/format` · `use-hotkeys` 로 되는지 먼저 본다. 탭 바, 검색칸, 빈 상태, 진행 막대, 시간 포맷을 다시 만들지 않는다.
- 다음 단계 계획: 도메인 타입을 `src/domain`, 데이터 접근을 `src/api`(목업은 `api/mock`)로 분리해 백엔드 연결 시 한 곳만 바꾸게 한다.

## UI

- 라이트 테마만, 데스크톱 전용 (1280×720 ~ 1920×1080 에서 확인). 모바일 대응은 하지 않는다.
- 글꼴은 Pretendard. 페이지는 `Page` + `Panel` 틀, 상태는 색 배경 pill 대신 `StatusDot`(점 + 글자), 그림자 · 그라데이션 없이 얇은 테두리.
- 카드 나열보다 목록 · 표. 긴 목록은 검색 · 필터 · 페이지 나눔을 먼저 생각한다 (에피소드 · 데이터셋이 수만 개가 될 수 있다).
- 같은 종류 그래프는 Capture 의 JointPlots 모양(캔버스, 한 지표당 한 칸, 오른쪽 위 최신 값)을 따른다.
- 화면 문구: 버튼 · 라벨은 영어, 설명 · 안내 문구는 한국어.
