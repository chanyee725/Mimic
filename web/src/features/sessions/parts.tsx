import { LuPlay } from "react-icons/lu"

import { Panel } from "@/components/app/page"
import { StatusDot, type Tone } from "@/components/app/status-dot"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  EPISODE_CHECKS,
  REPLAY_SEGMENTS,
  type Episode,
  type Review,
  type Session,
  type SessionStatus,
} from "@/dummy/sessions"
import type { Outcome } from "@/dummy/tasks"
import { cn } from "@/lib/utils"

const SESSION_TONE: Record<SessionStatus, Tone> = { recording: "bad", review: "warn", converted: "ok" }
const OUTCOME_TONE: Record<Outcome, Tone> = { success: "ok", fail: "bad", partial: "warn" }
const SEGMENT_COLORS = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-5"]

export function SessionList({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: Session[]
  selectedId?: string
  onSelect: (id: string) => void
}) {
  return (
    <Panel
      title="Sessions"
      action={<span className="text-[13px] text-muted-foreground">{sessions.length} in this task</span>}
    >
      <ul className="-mx-2 min-h-0 flex-1 divide-y overflow-y-auto">
        {sessions.map((s) => {
          const selected = s.id === selectedId
          return (
            <li key={s.id} className="py-1">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "grid w-full gap-2 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/50",
                  selected && "bg-muted/60 hover:bg-muted/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-medium">{s.id}</span>
                  <StatusDot tone={SESSION_TONE[s.status]} className="text-xs text-muted-foreground">
                    {s.status}
                  </StatusDot>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {s.operator} · {s.episodes} ep · {s.date}
                </span>
                <div
                  className="flex h-1 overflow-hidden rounded-full bg-muted"
                  aria-label={`success ${s.successPct}%, fail ${s.failPct}%`}
                >
                  <div className="bg-ok" style={{ width: `${s.successPct}%` }} />
                  <div className="bg-bad" style={{ width: `${s.failPct}%` }} />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

export function ReplayPanel({
  episode,
  review,
  onReview,
}: {
  episode: Episode
  review: Review
  onReview: (r: Review) => void
}) {
  return (
    <Panel
      title={`Episode ${episode.index}`}
      action={<ReviewLabel review={review} />}
      className="shrink-0"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            {["front", "wrist"].map((cam) => (
              <div
                key={cam}
                className="flex aspect-video items-center justify-center rounded-md border bg-stage font-mono text-xs text-muted-foreground"
              >
                {cam} · ep {episode.index}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="icon" aria-label="Play episode">
              <LuPlay />
            </Button>
            <div className="grid flex-1 gap-1">
              <div className="flex h-1.5 overflow-hidden rounded-full">
                {REPLAY_SEGMENTS.map((g, i) => (
                  <div key={g.name} className={cn("opacity-80", SEGMENT_COLORS[i % SEGMENT_COLORS.length])} style={{ width: `${g.pct}%` }} />
                ))}
              </div>
              <div className="flex font-mono text-[11px] text-muted-foreground">
                {REPLAY_SEGMENTS.map((g) => (
                  <span key={g.name} style={{ width: `${g.pct}%` }}>
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
            <span className="font-mono text-xs text-muted-foreground">00.0 / {episode.lengthS.toFixed(1)}s</span>
          </div>
        </div>

        <div className="grid content-start gap-2.5">
          <h3 className="text-[13px] font-medium text-muted-foreground">Validation</h3>
          <ul className="grid gap-2">
            {EPISODE_CHECKS.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[13px]">
                <StatusDot tone={c.ok ? "ok" : "bad"} className="min-w-0 flex-1 text-[13px]">
                  <span className="truncate">{c.label}</span>
                </StatusDot>
                <span className={cn("font-mono text-xs whitespace-nowrap", c.ok ? "text-muted-foreground" : "text-bad")}>
                  {c.value}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1 flex gap-2">
            <Button className="flex-1" onClick={() => onReview("accepted")} disabled={review === "accepted"}>
              Accept
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-bad"
              onClick={() => onReview("rejected")}
              disabled={review === "rejected"}
            >
              Reject
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function ReviewLabel({ review }: { review: Review }) {
  const tone: Tone = review === "accepted" ? "ok" : review === "rejected" ? "bad" : "muted"
  return (
    <StatusDot tone={tone} className="text-[13px] text-muted-foreground">
      {review}
    </StatusDot>
  )
}

export function EpisodesTable({
  episodes,
  reviewOf,
  selectedIndex,
  onSelect,
  subtaskCount,
}: {
  episodes: Episode[]
  reviewOf: (e: Episode) => Review
  selectedIndex: number
  onSelect: (index: number) => void
  subtaskCount: number
}) {
  return (
    <Panel
      title="Episodes"
      action={<span className="text-[13px] text-muted-foreground">{episodes.length} episodes</span>}
      className="flex-1"
    >
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground">#</TableHead>
              <TableHead className="text-muted-foreground">Length</TableHead>
              <TableHead className="text-right text-muted-foreground">Action 60Hz</TableHead>
              <TableHead className="text-right text-muted-foreground">Video 30fps</TableHead>
              <TableHead className="text-right text-muted-foreground">Drop</TableHead>
              <TableHead className="text-muted-foreground">Outcome</TableHead>
              <TableHead className="text-muted-foreground">Subtasks</TableHead>
              <TableHead className="text-muted-foreground">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {episodes.map((e) => {
              const review = reviewOf(e)
              const dropped = e.dropPct > 1
              return (
                <TableRow
                  key={e.index}
                  data-state={e.index === selectedIndex ? "selected" : undefined}
                  onClick={() => onSelect(e.index)}
                  className={cn("cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted/60", dropped && "bg-bad-muted/40")}
                >
                  <TableCell className="font-mono">
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onSelect(e.index)
                      }}
                    >
                      {e.index}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono">{e.lengthS.toFixed(1)}s</TableCell>
                  <TableCell className="text-right font-mono">{e.actionSamples.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{e.videoFrames.toLocaleString()}</TableCell>
                  <TableCell className={cn("text-right font-mono", dropped && "text-bad")}>{e.dropPct.toFixed(1)}%</TableCell>
                  <TableCell>
                    <StatusDot tone={OUTCOME_TONE[e.outcome]} className="text-[13px]">
                      {e.outcome}
                    </StatusDot>
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex w-24 gap-0.5"
                      aria-label={`${Math.min(e.subtasksDone, subtaskCount)} of ${subtaskCount} subtasks`}
                    >
                      {Array.from({ length: subtaskCount }, (_, k) => (
                        <span
                          key={k}
                          className={cn(
                            "h-1.5 flex-1 rounded-xs",
                            k < e.subtasksDone ? SEGMENT_COLORS[k % SEGMENT_COLORS.length] : "bg-muted",
                          )}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ReviewLabel review={review} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </Panel>
  )
}
