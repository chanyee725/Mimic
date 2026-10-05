import { useEffect } from "react"

import { API_BASE } from "./client"
import { qk, queryClient } from "./query"

export type ServerEvent = { type: string; at: string; data: unknown }

// Event type prefix → query roots to refetch (docs/api/realtime.md)
const INVALIDATES: Record<string, readonly (readonly string[])[]> = {
  capture: [qk.capture],
  recording: [qk.recordings, qk.convert, qk.tasks, qk.sessions, qk.station],
  dataset: [qk.datasets],
  training: [qk.training, qk.models],
  evaluate: [qk.evaluate, qk.models],
  sim: [qk.sim],
  device: [qk.devices, qk.rigs],
  station: [qk.station],
  task: [qk.tasks],
  settings: [qk.settings],
}

/** Forget cached detail queries of a deleted resource so they don't refetch into a 404 */
function dropDeleted(roots: readonly (readonly string[])[], data: unknown) {
  const d = (data ?? {}) as { id?: string; repoId?: string; ids?: string[] }
  // Bulk deletes send `ids`
  const ids = new Set(d.ids ?? [d.id ?? d.repoId].filter((x): x is string => !!x))
  if (!ids.size) return
  for (const root of roots) queryClient.removeQueries({ queryKey: root, predicate: (q) => q.queryKey.some((k) => ids.has(k as string)) })
}

const listeners = new Set<(e: ServerEvent) => void>()

/** Listen to raw events (e.g. per-step training.metrics) without refetching */
export function onServerEvent(fn: (e: ServerEvent) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Keeps one events socket open while mounted (the app layout) and reconnects after drops */
export function useServerEvents() {
  useEffect(() => {
    let ws: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let closed = false
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws"
      ws = new WebSocket(`${proto}://${location.host}${API_BASE}/ws/events`)
      ws.onmessage = (m) => {
        const e = JSON.parse(m.data) as ServerEvent
        if (e.type === "hello" || e.type === "pong") return
        listeners.forEach((l) => l(e))
        if (e.type === "training.metrics") return // high rate: listeners only
        const roots = INVALIDATES[e.type.split(".")[0]] ?? []
        if (e.type.endsWith(".deleted")) dropDeleted(roots, e.data)
        for (const key of roots) queryClient.invalidateQueries({ queryKey: key })
      }
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 2000)
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
    }
  }, [])
}
