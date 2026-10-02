# api

Data access for the UI. Pages and components import data **only** from here, never from `@/dummy`.

Every function currently returns mock data from `src/dummy` synchronously. When the backend lands,
replace the bodies here (FastAPI via fetch / TanStack Query, gRPC streams, WebRTC) and turn list/get
functions into query hooks; callers then change in one predictable way.
