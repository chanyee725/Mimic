// Thin fetch wrapper for the station backend (docs/api). Same-origin /api/v1; Vite proxies it in dev.

export const API_BASE = "/api/v1"

/** Error body of every non-2xx response: { error: { code, message, details } } */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>

function url(path: string, query?: Query) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    params.set(k, Array.isArray(v) ? v.join(",") : String(v))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const isText = typeof body === "string"
  const res = await fetch(url(path, query), {
    method,
    headers: body === undefined ? undefined : { "Content-Type": isText ? "text/yaml" : "application/json" },
    body: body === undefined ? undefined : isText ? body : JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const e = err?.error
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? res.statusText, e?.details ?? {})
  }
  if (res.status === 204) return undefined as T
  const type = res.headers.get("content-type") ?? ""
  return (type.includes("application/json") ? res.json() : res.text()) as Promise<T>
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, body ?? {}, query),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
}

/** Cursor-paged list (recordings, dataset episodes, sim episodes) */
export type Page<T> = { items: T[]; nextCursor: string | null; total: number }
