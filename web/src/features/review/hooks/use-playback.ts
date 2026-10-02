import { useCallback, useEffect, useRef, useState } from "react"

import type { Speed } from "../lib"

/**
 * Playback state: advances time with rAF but limits React updates to about 30 fps.
 * Plots read timeRef directly via playhead() and redraw every frame.
 */
export function usePlayback(dur: number) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)

  const timeRef = useRef(0)
  const playhead = useCallback(() => timeRef.current, [])
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastCommit = last
    const tick = (now: number) => {
      const next = Math.min(dur, timeRef.current + ((now - last) / 1000) * speed)
      timeRef.current = next
      last = now
      if (next >= dur) {
        setTime(dur)
        setPlaying(false)
        return
      }
      if (now - lastCommit >= 33) {
        setTime(next)
        lastCommit = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, dur])

  const seek = (t: number) => {
    timeRef.current = t
    setTime(t)
  }
  const togglePlay = () => {
    if (!playing && timeRef.current >= dur) seek(0)
    setPlaying((p) => !p)
  }

  return { time, playing, speed, setSpeed, playhead, seek, togglePlay }
}
