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
 * 저장된 MCAP 에피소드 재생.
 * 호출하는 쪽에서 recording id 로 key 를 주어 파일이 바뀌면 재생 위치를 처음으로 되돌린다.
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
    // 플레이어에 포커스가 있을 때만 Space 로 재생/정지 (전역 단축키 없음)
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
      {/* Capture 와 같은 카메라 타일 · 관절 그래프 컴포넌트를 쓴다 */}
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

      {/* 재생 바: 상자 없이 그래프 바로 아래에 하단 고정 */}
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
