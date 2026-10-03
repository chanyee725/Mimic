# VLA Data Pipeline — web

SO-101 텔레오퍼레이션 데이터 수집 → 검수 → LeRobot 변환 → 학습 · 평가를 다루는 프론트엔드.
데이터는 모두 백엔드(`backend/`, FastAPI)에서 React Query 로 받아 온다. 개발할 때는 백엔드를 `:8000` 에 띄우고 `npm run dev` 를 실행한다 (다른 주소면 `VITE_API_TARGET`).

## 시작

```sh
nvm use        # Node 24
npm install
npm run dev    # http://localhost:5173
```

## 스크립트

| 명령                              | 내용                                |
| --------------------------------- | ----------------------------------- |
| `npm run dev`                     | 개발 서버                           |
| `npm run build`                   | 타입 검사 + 프로덕션 빌드           |
| `npm run typecheck`               | `tsc -b`                            |
| `npm run lint` / `lint:fix`       | oxlint                              |
| `npm run format` / `format:check` | prettier (`src/components/ui` 제외) |
| `npm run check`                   | typecheck + lint + format:check     |

## 구조

- `src/app` — 라우트, 사이드바 내비게이션, 레이아웃
- `src/features/<name>` — 페이지 단위 기능 (`page.tsx` + `components/` + `hooks/` + `lib.ts`)
- `src/components/ui` — shadcn CLI 가 관리하는 파일 (직접 고치지 않는다)
- `src/components/app`, `src/components/robot` — 여러 기능이 같이 쓰는 컴포넌트
- `src/api` — 백엔드 훅 (React Query), `src/domain` — 백엔드 JSON 과 같은 타입
- `src/lib`, `src/hooks` — 공용 함수 · 훅

스택: React 19 · TypeScript 6 · Vite 8 · Tailwind v4 · shadcn/ui (base-ui) · react-router · react-icons · Pretendard.
