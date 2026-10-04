import { useEffect, useState } from "react"

import { getTeleopSamples } from "@/api/rigs"
import type { RecordingSamples } from "@/domain/recording"

const POLL_MS = 100

/**
 * Live leader (action) / follower (state) joints of the rig's running teleop, as a rolling window for JointPlots.
 * Polls only new samples (after the last seq) every 100 ms; null while teleop is off.
 */
export function useTeleopSamples(rigId: string | undefined, running: boolean, windowSec = 5): RecordingSamples | null {
  const [data, setData] = useState<RecordingSamples | null>(null)

  useEffect(() => {
    if (!rigId || !running) return
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let seq = 0
    let joints: string[] = []
    let t: number[] = []
    let action: number[][] = [] // per joint
    let state: number[][] = []

    const tick = async () => {
      try {
        const r = await getTeleopSamples(rigId, seq)
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
  }, [rigId, running, windowSec])

  return running ? data : null
}
