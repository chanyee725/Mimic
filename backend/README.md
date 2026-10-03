# backend

스테이션 백엔드 (FastAPI, Python 3.12). API 명세: [docs/api](../docs/api/README.md)

```sh
cd backend
uv sync                                   # Python 3.12 가상환경 + 의존성
uv run uvicorn app.main:app --reload      # http://localhost:8000/api/v1/docs
uv run pytest                             # 테스트
uv run black .                            # 포맷
```

구조: `app/<area>/` 마다 `router.py` · `schemas.py` · `service.py` · `seed.py`. 지금은 메모리에 목업과 같은 데이터를 두고 동작합니다.

## 목업 데이터

`app/core/seed/*.json` 은 웹 목업(`web/src/dummy`)을 그대로 내보낸 것입니다. 웹 목업을 바꾸면 다시 만듭니다:

```sh
cd web && npx tsx --tsconfig tsconfig.app.json ../backend/scripts/dump-seed.ts
```
