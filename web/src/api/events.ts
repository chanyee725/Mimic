import { useEffect } from "react"

import { API_BASE } from "./client"
import { qk, queryClient } from "./query"

export type ServerEvent = { type: string; at: string; data: unknown }

// Event type prefix → query roots to refetch (docs/api/realtime.md)
const INVALIDATES: Record<string, readonly (readonly string[])[]> = {
  capture: [qk.capture],
  recording: [qk.recordings, qk.convert, qk.tasks],
  dataset: [qk.datasets],
  training: [qk.training, qk.models],
  evaluate: [qk.evaluate, qk.models],
  sim: [qk.sim],
  device: [qk.devices, qk.rigs],
  station: [qk.station],
  task: [qk.tasks],
  settings: [qk.settings],
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
        for (const key of INVALIDATES[e.type.split(".")[0]] ?? []) queryClient.invalidateQueries({ queryKey: key })
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
