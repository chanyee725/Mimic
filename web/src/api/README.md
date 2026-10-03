# api

Data access for the UI: React Query hooks over the station backend (`docs/api`, `backend/`).
Pages and components import data **only** from here; types come from `src/domain`.

- `client.ts` — fetch wrapper for `/api/v1` (Vite proxies `/api` to `VITE_API_TARGET`, default `http://localhost:8000`).
- `query.ts` — query client and key roots per area; every key starts with its area root.
- `events.ts` — events WebSocket; refetches the affected areas and exposes `onServerEvent` for raw events.
- `<area>.ts` — `useX()` queries, `useXMutation`-style hooks for actions, URL helpers for downloads.

Mock data lives in the backend (`backend/app/seeds/data`).
