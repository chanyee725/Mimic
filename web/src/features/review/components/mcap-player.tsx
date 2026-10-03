import { useMemo } from "react"
import { LuPause, LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { JointPlots } from "@/components/robot/joint-plots"
import { VideoTile } from "@/components/robot/video-tile"
import { useRecordingSamples } from "@/api/recordings"
import { useRig } from "@/api/rigs"
import type { Recording, SampleTopic } from "@/domain/recording"
import { formatClock } from "@/lib/format"
import { cn } from "@/lib/utils"

import { usePlayback } from "../hooks/use-playback"
import { cameraLabel, samplesHz } from "../lib"
import { Scrubber } from "./scrubber"
import { SpeedToggle } from "./speed-toggle"
import { StreamList } from "./stream-list"

/**
 * Plays back a saved MCAP episode. Video (501 until storage exists) shows "No signal" and the joint plots
 * replay the series from the samples endpoint.
 * Callers key it by recording id so playback restarts when the file changes.
 */
export function McapPlayer({ recording, className }: { recording: Recording; className?: string }) {
  const dur = recording.durationS
  const { time, playing, speed, setSpeed, playhead, seek, togglePlay } = usePlayback(dur)

  const videos = recording.topics.filter((t) => t.kind === "video")
  const topics = useMemo(
    () => (["action", "state"] as SampleTopic[]).filter((k) => recording.topics.some((t) => t.kind === k)),
    [recording.topics],
  )
  const hasJoints = topics.length > 0
  const rig = useRig(recording.rigId ?? undefined).data
  const actionHz = recording.topics.find((t) => t.kind === "action")?.rateHz ?? 60
  const samples = useRecordingSamples(recording.id, { topics, hz: samplesHz(actionHz, dur) })

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
            hint="이 녹화에는 아직 영상 프레임이 없습니다."
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
          joints={rig?.joints ?? []}
          hz={actionHz}
          actionSource={rig?.master}
          stateSource={rig?.slave}
          data={samples.data}
          playhead={playhead}
          emptyLabel={samples.isPending ? "Loading…" : "No data"}
          hint={
            samples.isPending ? "관절 데이터를 불러오는 중입니다." : (samples.error?.message ?? "이 파일에서 관절값을 읽지 못했습니다.")
          }
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
