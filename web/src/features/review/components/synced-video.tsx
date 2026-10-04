import { useEffect, useRef, useState } from "react"
import { LuVideoOff } from "react-icons/lu"

/** Larger gaps between the video and the playhead are corrected by seeking the video */
const MAX_DRIFT_S = 0.15

/**
 * One recorded camera, slaved to the player's clock: plays / pauses with it, follows its speed and seeks
 * when it drifts. The playback hook stays the source of truth (the video never moves the playhead).
 */
export function SyncedVideo({
  src,
  playing,
  speed,
  time,
  playhead,
}: {
  src: string
  playing: boolean
  speed: number
  /** Committed playback time (changes on seek and while playing) */
  time: number
  playhead: () => number
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  // Seek to the playhead (clamped to the video's own length)
  const align = (force = false) => {
    const v = ref.current
    if (!v || state !== "ready") return
    const end = Number.isFinite(v.duration) ? v.duration : Infinity
    const target = Math.min(playhead(), end)
    if (force || Math.abs(v.currentTime - target) > MAX_DRIFT_S) v.currentTime = target
  }

  useEffect(() => {
    const v = ref.current
    if (!v || state !== "ready") return
    v.playbackRate = speed
    if (playing && playhead() < v.duration) void v.play().catch(() => {})
    else v.pause()
    align(!playing)
    // align reads the latest refs; re-run only when transport state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, state])

  // Seeks (and the ~30 fps commits while playing) re-check the drift
  useEffect(() => {
    align(!playing)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time])

  return (
    <>
      <video
        ref={ref}
        src={src}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 size-full object-contain"
        onLoadedData={() => setState("ready")}
        onError={() => setState("failed")}
      />
      {state !== "ready" && (
        <div className="relative flex flex-col items-center gap-1 px-4 text-center text-xs text-muted-foreground">
          {state === "loading" ? (
            "Loading…"
          ) : (
            <>
              <LuVideoOff className="mb-0.5 size-6" />
              <span className="font-medium text-foreground">No signal</span>
              영상을 불러오지 못했습니다.
            </>
          )}
        </div>
      )}
    </>
  )
}
