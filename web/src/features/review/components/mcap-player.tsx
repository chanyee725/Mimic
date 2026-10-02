import { useEffect, useMemo, useRef, useState } from "react"
import { LuPause, LuPlay, LuVideo } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import type { McapTopic, Recording } from "@/dummy/recordings"
import { getRig } from "@/dummy/rigs"
import { cn } from "@/lib/utils"

const SPEEDS = [0.5, 1, 2] as const
const SEGMENT_VARS = ["--series-1", "--series-2", "--series-3", "--series-4", "--series-5"]
const TRACE_POINTS = 240
const PLOT_W = 300
const PLOT_H = 60

const pad2 = (n: number) => String(n).padStart(2, "0")

/** mm:ss:ff (30 fps 프레임) */
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

function jointNamesOf(recording: Recording, hasJoints: boolean) {
  if (recording.rigId) return getRig(recording.rigId).joints
  return hasJoints ? Array.from({ length: 6 }, (_, i) => `j${i}`) : []
}

function VideoPane({ topic, time }: { topic: McapTopic; time: number }) {
  return (
    <figure className="relative m-0 flex min-h-0 items-center justify-center overflow-hidden rounded-md border bg-stage">
      {/* 실제로는 MCAP 의 CompressedVideo 프레임을 디코딩해 그린다 */}
      <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
        <LuVideo className="size-6" />
        Replay
      </div>
      <figcaption className="absolute top-2 left-2 max-w-[70%] truncate rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
        {topic.name}
      </figcaption>
      <span className="absolute top-2 right-2 rounded-md bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background tabular-nums">
        {timecode(time, topic.rateHz ?? 30)}
      </span>
      <span className="absolute right-2 bottom-2 rounded-md border bg-background px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
        640×480, {topic.rateHz ?? "—"} fps
      </span>
    </figure>
  )
}

function Scrubber({
  recording,
  time,
  onSeek,
}: {
  recording: Recording
  time: number
  onSeek: (t: number) => void
}) {
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
      className="relative h-9 cursor-pointer touch-none rounded-md border bg-muted/40 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {/* 서브태스크 구간 */}
      {recording.subtasks.map((s, i) => (
        <div
          key={s.name}
          className="absolute top-1 bottom-4 overflow-hidden rounded-sm px-1 text-[10px] leading-4 font-medium text-white"
          style={{
            left: pct(s.startS),
            width: `calc(${pct(s.endS - s.startS)} - 2px)`,
            background: `var(${SEGMENT_VARS[i % SEGMENT_VARS.length]})`,
            opacity: 0.85,
          }}
        >
          <span className="truncate">{s.name}</span>
        </div>
      ))}
      {/* 프레임 드랍 */}
      {recording.drops.map((d) => (
        <span
          key={d}
          className="absolute bottom-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-bad"
          style={{ left: pct(d) }}
          title={`Frame drop at ${clock(d)}`}
        />
      ))}
      {/* 재생 위치 */}
      <span className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: pct(time) }}>
        <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-foreground" />
      </span>
    </div>
  )
}

function JointTraces({ recording, joints, time }: { recording: Recording; joints: string[]; time: number }) {
  const seed = seedOf(recording.id)
  const dur = recording.durationS

  // 에피소드 전체 궤적은 파일별로 한 번만 계산한다
  const paths = useMemo(() => {
    const value = (i: number, t: number) =>
      (Math.sin(t * (0.45 + (i % 6) * 0.18) + i * 1.3 + seed * 6) * 0.7 + Math.sin(t * 2.3 + i + seed) * 0.08) * 90
    const y = (v: number) => PLOT_H / 2 - (v / 90) * (PLOT_H / 2 - 4)
    const path = (i: number, lag: number) =>
      Array.from({ length: TRACE_POINTS }, (_, k) => {
        const t = (k / (TRACE_POINTS - 1)) * dur
        return `${k ? "L" : "M"}${((k / (TRACE_POINTS - 1)) * PLOT_W).toFixed(1)},${y(value(i, t - lag)).toFixed(1)}`
      }).join("")
    return joints.map((_, i) => ({ action: path(i, 0), state: path(i, 0.15) }))
  }, [joints, dur, seed])

  return (
    <div className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 overflow-y-auto">
      {joints.map((j, i) => (
        <figure key={j} className="m-0 grid gap-0.5 rounded-md border bg-card px-2 pt-1 pb-1.5">
          <figcaption className="truncate text-[11px] font-medium">{j}</figcaption>
          <div className="relative h-14">
            <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
              <line x1={0} x2={PLOT_W} y1={PLOT_H / 2} y2={PLOT_H / 2} className="stroke-border" vectorEffect="non-scaling-stroke" />
              <path d={paths[i].state} fill="none" strokeDasharray="4 3" className="stroke-series-3" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              <path d={paths[i].action} fill="none" className="stroke-series-1" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute inset-y-0 w-px bg-foreground/50" style={{ left: `${(time / dur) * 100}%` }} />
          </div>
        </figure>
      ))}
    </div>
  )
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

function Player({ recording, className }: { recording: Recording; className?: string }) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const dur = recording.durationS

  const videos = recording.topics.filter((t) => t.kind === "video")
  const hasJoints = recording.topics.some((t) => t.kind === "action" || t.kind === "state")
  const joints = useMemo(() => jointNamesOf(recording, hasJoints), [recording, hasJoints])
  const otherTopics = recording.topics.filter((t) => t.kind !== "video")

  // 재생: rAF 로 시간을 진행시키되 React 갱신은 약 30 fps 로 제한한다
  const timeRef = useRef(0)
  useEffect(() => {
    timeRef.current = time
  }, [time])
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
      className={cn("flex min-h-0 flex-col gap-3 outline-none", className)}
    >
      <div
        className={cn(
          "grid min-h-40 flex-1 gap-2",
          videos.length > 1 ? "md:grid-cols-2" : "grid-cols-1",
        )}
      >
        {videos.map((v) => (
          <VideoPane key={v.name} topic={v} time={time} />
        ))}
        {videos.length === 0 && (
          <div className="flex items-center justify-center rounded-md border bg-stage text-xs text-muted-foreground">
            No video topics in this file
          </div>
        )}
      </div>

      <div className="grid shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause (Space)" : "Play (Space)"}
            onClick={togglePlay}
          >
            {playing ? <LuPause /> : <LuPlay />}
          </Button>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Playback speed">
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
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            <span className="text-foreground">{clock(time)}</span> / {clock(dur)}
          </span>
        </div>
        <Scrubber recording={recording} time={time} onSeek={seek} />
        {(recording.subtasks.length > 0 || recording.drops.length > 0) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {recording.subtasks.length > 0 && <span>Bands show subtask segments</span>}
            {recording.drops.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-0.5 rounded-full bg-bad" />
                {recording.drops.length} frame drop{recording.drops.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex max-h-[40%] min-h-24 shrink-0 flex-col gap-1.5">
        {hasJoints ? (
          <>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-series-1" />
                Action
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full border-t border-dashed border-series-3" />
                Observation
              </span>
            </div>
            <JointTraces recording={recording} joints={joints} time={time} />
          </>
        ) : (
          <StreamList topics={otherTopics} />
        )}
      </div>
    </div>
  )
}

/** 저장된 MCAP 에피소드 재생. 파일이 바뀌면 재생 위치를 처음으로 되돌린다 */
export function McapPlayer({ recording, className }: { recording: Recording; className?: string }) {
  return <Player key={recording.id} recording={recording} className={className} />
}
