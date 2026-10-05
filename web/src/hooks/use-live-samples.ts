import { useEffect, useState } from "react"

import type { RecordingSamples } from "@/domain/recording"
import type { TeleopSamples } from "@/domain/teleop"

const POLL_MS = 100

/**
 * Live action / follower state joints as a rolling window for JointPlots: Capture's teleop, Evaluate's policy run.
 * `fetch(after)` returns the samples after a seq (null: no session); `key` names the source and restarts the poll.
 * Polls only new samples every 100 ms; null while not running.
 */
export function useLiveSamples(
  key: string | undefined,
  running: boolean,
  fetch: (key: string, after: number) => Promise<TeleopSamples | null>,
  windowSec = 5,
): RecordingSamples | null {
  const [data, setData] = useState<RecordingSamples | null>(null)

  useEffect(() => {
    if (!key || !running) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let seq = 0
    let joints: string[] = []
    let t: number[] = []
    let action: number[][] = [] // per joint
    let state: number[][] = []

    const tick = async () => {
      try {
        const r = await fetch(key, seq)
        if (!alive || !r) return
        // A lower seq means a new session: start over
        if (r.seq < seq || r.joints.length !== joints.length) {
          joints = r.joints
          t = []
          action = r.joints.map(() => [])
          state = r.joints.map(() => [])
        }
        seq = r.seq
        if (r.t.length === 0) return
        t = t.concat(r.t)
        action = action.map((col, j) => col.concat(r.action.map((row) => row[j])))
        state = state.map((col, j) => col.concat(r.state.map((row) => row[j])))
        // Keep the visible window only
        const from = t.findIndex((x) => x >= t[t.length - 1] - windowSec)
        if (from > 0) {
          t = t.slice(from)
          action = action.map((col) => col.slice(from))
          state = state.map((col) => col.slice(from))
        }
        setData({ joints, t, series: { action, state } })
      } catch {
        // Transient errors: keep polling
      } finally {
        if (alive) timer = setTimeout(tick, POLL_MS)
      }
    }
    void tick()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [key, running, fetch, windowSec])

  return running ? data : null
}
