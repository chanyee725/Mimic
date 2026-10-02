import { useCallback, useEffect, useRef, useState } from "react"

import type { Speed } from "../lib"

/**
 * 재생 상태: rAF 로 시간을 진행시키되 React 갱신은 약 30 fps 로 제한한다.
 * 그래프는 playhead() 로 timeRef 를 직접 읽어 매 프레임 그린다.
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
