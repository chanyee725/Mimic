import { useMemo } from "react"
import { LuPause, LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { JointPlots } from "@/components/robot/joint-plots"
import { VideoTile } from "@/components/robot/video-tile"
import type { Recording } from "@/dummy/recordings"
import { getRig } from "@/dummy/rigs"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import { usePlayback } from "../hooks/use-playback"
import { cameraLabel, seedOf } from "../lib"
import { Scrubber } from "./scrubber"
import { SpeedToggle } from "./speed-toggle"
import { StreamList } from "./stream-list"

/**
 * Plays back a saved MCAP episode.
 * Callers key it by recording id so playback restarts when the file changes.
 */
export function McapPlayer({ recording, className }: { recording: Recording; className?: string }) {
  const dur = recording.durationS
  const { time, playing, speed, setSpeed, playhead, seek, togglePlay } = usePlayback(dur)

  const videos = recording.topics.filter((t) => t.kind === "video")
  const hasJoints = recording.topics.some((t) => t.kind === "action" || t.kind === "state")
  const rig = recording.rigId ? getRig(recording.rigId) : undefined
  const joints = useMemo(() => rig?.joints ?? Array.from({ length: 6 }, (_, i) => `j${i}`), [rig])
  const actionHz = recording.topics.find((t) => t.kind === "action")?.rateHz ?? 60

  return (
    // Space toggles play / pause only while the player has focus (no global hotkey)
    <div
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.code !== "Space") return
        const el = e.target as HTMLElement
        if (el.closest("button, input, textarea, select")) return
        e.preventDefault()
        togglePlay()
      }}
      className={cn("flex min-h-0 flex-col gap-4 outline-none", className)}
    >
      {/* Uses the same camera tile and joint plot components as Capture */}
      <div className={cn("grid min-h-48 flex-1 gap-3", videos.length > 1 ? "md:grid-cols-2" : "grid-cols-1")}>
        {videos.map((v) => (
          <VideoTile
            key={v.name}
            className="aspect-auto h-full min-h-48"
            label={cameraLabel(v.name)}
            resolution="640×480"
            measuredFps={v.rateHz}
            targetFps={v.rateHz}
            placeholder="Replay"
          />
        ))}
        {videos.length === 0 && (
          <div className="flex items-center justify-center rounded-lg border bg-stage text-xs text-muted-foreground">
            이 파일에는 영상 토픽이 없습니다.
          </div>
        )}
      </div>

      {hasJoints ? (
        <JointPlots
          joints={joints}
          hz={actionHz}
          actionSource={rig?.master}
          stateSource={rig?.slave}
          playhead={playhead}
          seed={seedOf(recording.id)}
          className="h-64 shrink-0"
        />
      ) : (
        <div className="h-48 shrink-0">
          <StreamList topics={recording.topics.filter((t) => t.kind !== "video")} />
        </div>
      )}

      {/* Transport bar: no box, pinned right below the plots */}
      <div className="-mt-2 flex shrink-0 items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause (Space)" : "Play (Space)"}
          onClick={togglePlay}
        >
          {playing ? <LuPause /> : <LuPlay />}
        </Button>
        <Scrubber duration={dur} time={time} onSeek={seek} />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          <span className="text-foreground">{formatClock(time, { tenths: true })}</span> / {formatClock(dur, { tenths: true })}
        </span>
        <SpeedToggle value={speed} onChange={setSpeed} />
      </div>
    </div>
  )
}
