import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LuPause, LuPlay } from "react-icons/lu"

import { JointPlots } from "@/components/robot/joint-plots"
import { VideoTile } from "@/components/robot/video-tile"
import { Button } from "@/components/ui/button"
import type { McapTopic, Recording } from "@/dummy/recordings"
import { getRig } from "@/dummy/rigs"
import { cn } from "@/lib/utils"

const SPEEDS = [0.5, 1, 2] as const

const pad2 = (n: number) => String(n).padStart(2, "0")

/** mm:ss:ff (프레임) */
function timecode(sec: number, fps = 30) {
  const frames = Math.floor(sec * fps)
  const s = Math.floor(frames / fps)
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}:${pad2(frames % fps)}`
}

function clock(sec: number) {
  const s = Math.floor(sec)
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}.${Math.floor((sec % 1) * 10)}`
}

/** recording id 로 고정되는 시드 (같은 파일은 항상 같은 궤적) */
function seedOf(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 1000
  return h / 1000
}

/** `/cam_top/image` → `Top`, 그 외는 토픽 이름 그대로 */
function cameraLabel(topic: string) {
  const cam = topic.match(/^\/cam_([^/]+)/)?.[1]
  return cam ? cam.charAt(0).toUpperCase() + cam.slice(1) : topic
}

function StreamList({ topics }: { topics: McapTopic[] }) {
  return (
    <div className="min-h-0 overflow-y-auto rounded-md border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-normal">Topic</th>
            <th className="px-3 py-2 font-normal">Schema</th>
            <th className="px-3 py-2 text-right font-normal">Rate</th>
            <th className="px-3 py-2 text-right font-normal">Messages</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {topics.map((t) => (
            <tr key={t.name}>
              <td className="max-w-48 truncate px-3 py-1.5">{t.name}</td>
              <td className="max-w-48 truncate px-3 py-1.5 text-muted-foreground">{t.schema}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.rateHz === null ? "event" : `${t.rateHz} Hz`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{t.messages.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 재생 위치 탐색 바. 프레임 드랍 지점만 빨간 눈금으로 표시한다 */
function Scrubber({ recording, time, onSeek }: { recording: Recording; time: number; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dur = recording.durationS
  const pct = (t: number) => `${(t / dur) * 100}%`

  const seekFromEvent = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    onSeek(Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur)))
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={dur}
      aria-valuenow={+time.toFixed(1)}
      aria-valuetext={clock(time)}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFromEvent(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && seekFromEvent(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1
        if (e.key === "ArrowRight") onSeek(Math.min(dur, time + step))
        else if (e.key === "ArrowLeft") onSeek(Math.max(0, time - step))
        else if (e.key === "Home") onSeek(0)
        else if (e.key === "End") onSeek(dur)
        else return
        e.preventDefault()
      }}
      className="group relative flex h-8 min-w-0 flex-1 cursor-pointer touch-none items-center rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="relative h-1.5 w-full rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: pct(time) }} />
        {recording.drops.map((d) => (
          <span
            key={d}
            className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bad"
            style={{ left: pct(d) }}
            title={`Frame drop at ${clock(d)}`}
          />
        ))}
        <span
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
          style={{ left: pct(time) }}
        />
      </div>
    </div>
  )
}

function Player({ recording, className }: { recording: Recording; className?: string }) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const dur = recording.durationS

  const videos = recording.topics.filter((t) => t.kind === "video")
  const hasJoints = recording.topics.some((t) => t.kind === "action" || t.kind === "state")
  const rig = recording.rigId ? getRig(recording.rigId) : undefined
  const joints = useMemo(() => rig?.joints ?? Array.from({ length: 6 }, (_, i) => `j${i}`), [rig])
  const actionHz = recording.topics.find((t) => t.kind === "action")?.rateHz ?? 60

  // 재생: rAF 로 시간을 진행시키되 React 갱신은 약 30 fps 로 제한한다.
  // 그래프는 timeRef 를 직접 읽어 매 프레임 그린다.
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
            timecode={timecode(time, v.rateHz ?? 30)}
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

      {/* 재생 바: 하단 고정 */}
      <div className="flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2">
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
        <Scrubber recording={recording} time={time} onSeek={seek} />
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          <span className="text-foreground">{clock(time)}</span> / {clock(dur)}
        </span>
        <div className="flex shrink-0 rounded-md border p-0.5" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={cn(
                "h-6 rounded-sm px-2 text-xs tabular-nums transition-colors",
                speed === s ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 저장된 MCAP 에피소드 재생. 파일이 바뀌면 재생 위치를 처음으로 되돌린다 */
export function McapPlayer({ recording, className }: { recording: Recording; className?: string }) {
  return <Player key={recording.id} recording={recording} className={className} />
}
