import { useRef, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { QueryView } from "@/components/common/query-state"
import { useEpisodeActivity } from "@/api/station"
import type { DayCount } from "@/domain/activity"
import { formatLength, plural } from "@/lib/format"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_LABELS: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" }

// 0 is empty, levels 1–4 are increasing shades of the ok colour
const LEVEL_CLASS = ["fill-muted", "fill-ok/25", "fill-ok/50", "fill-ok/75", "fill-ok"]
const LEGEND_CLASS = ["bg-muted", "bg-ok/25", "bg-ok/50", "bg-ok/75", "bg-ok"]

const CELL = 10
const GAP = 3
const STEP = CELL + GAP
const LEFT = 26 // weekday label width
const TOP = 14 // month label height
const LABEL_WEEKS = 2 // week columns a month label spans

function level(count: number, max: number) {
  if (count === 0) return 0
  return Math.min(4, Math.ceil((count / max) * 4))
}

/** GitHub-style contribution grid of episodes collected per day, one column per week. SVG, so it scales to the panel width. */
export function EpisodeHeatmap() {
  const activity = useEpisodeActivity()
  return (
    <QueryView
      query={activity}
      loading={
        <div className="grid gap-3">
          <h2 className="text-sm font-semibold">Episodes collected</h2>
          <Skeleton className="aspect-[730/101] w-full" />
        </div>
      }
    >
      {(days) => <ActivityGrid days={days} />}
    </QueryView>
  )
}

function ActivityGrid({ days }: { days: DayCount[] }) {
  const firstDow = days.length ? new Date(`${days[0].date}T00:00:00`).getDay() : 0
  const cells: (DayCount | null)[] = [...Array(firstDow).fill(null), ...days]
  const weeks: (DayCount | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((a, d) => a + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length

  // Month label only on the first week of each month; skip one that would run past the grid or into the previous label
  let lastLabel = -LABEL_WEEKS
  const monthLabels = weeks.map((w, i) => {
    const first = w.find(Boolean)
    const prev = i > 0 ? weeks[i - 1].find(Boolean) : null
    if (!first) return ""
    const m = Number(first.date.slice(5, 7)) - 1
    if (prev && Number(prev.date.slice(5, 7)) - 1 === m) return ""
    if (i > weeks.length - LABEL_WEEKS || i - lastLabel < LABEL_WEEKS) return ""
    lastLabel = i
    return MONTHS[m]
  })

  const box = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ day: DayCount; x: number; y: number; width: number } | null>(null)
  const show = (day: DayCount, cell: SVGRectElement) => {
    const outer = box.current?.getBoundingClientRect()
    const r = cell.getBoundingClientRect()
    if (outer) setHover({ day, x: r.left + r.width / 2 - outer.left, y: r.top - outer.top, width: outer.width })
  }

  const width = LEFT + weeks.length * STEP - GAP
  const height = TOP + 7 * STEP - GAP

  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold">Episodes collected</h2>
        <span className="text-[13px] text-muted-foreground">
          <span className="font-mono text-foreground">{total.toLocaleString()}</span> {total === 1 ? "episode" : "episodes"} ·{" "}
          {plural(activeDays, "active day")}
        </span>
      </div>

      <div ref={box} className="relative" onMouseLeave={() => setHover(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${plural(total, "episode")} over ${plural(days.length, "day")}`}
        >
          {monthLabels.map((m, i) =>
            m ? (
              <text key={`m${i}`} x={LEFT + i * STEP} y={9} className="fill-muted-foreground text-[9px]">
                {m}
              </text>
            ) : null,
          )}
          {Object.entries(DAY_LABELS).map(([d, label]) => (
            <text key={label} x={0} y={TOP + Number(d) * STEP + CELL - 2} className="fill-muted-foreground text-[9px]">
              {label}
            </text>
          ))}
          {weeks.map((w, i) =>
            w.map((day, d) =>
              day ? (
                <rect
                  key={day.date}
                  x={LEFT + i * STEP}
                  y={TOP + d * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  className={cn(LEVEL_CLASS[level(day.count, max)], hover?.day.date === day.date && "stroke-foreground/60")}
                  onMouseEnter={(e) => show(day, e.currentTarget)}
                />
              ) : null,
            ),
          )}
        </svg>
        {hover && <DayTooltip {...hover} />}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
        Less
        {LEGEND_CLASS.map((c) => (
          <span key={c} className={cn("size-2.75 rounded-[2px]", c)} />
        ))}
        More
      </div>
    </div>
  )
}

const TOOLTIP_W = 256

/** What the hovered day recorded, per task; kept inside the panel horizontally */
function DayTooltip({ day, x, y, width }: { day: DayCount; x: number; y: number; width: number }) {
  const left = Math.max(0, Math.min(x - TOOLTIP_W / 2, width - TOOLTIP_W))
  const weekday = WEEKDAYS[new Date(`${day.date}T00:00:00`).getDay()]
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-y-full rounded-md border bg-background px-3 py-2 text-xs"
      style={{ left, top: y - 6, width: TOOLTIP_W }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">
          {day.date} ({weekday})
        </span>
        <span className="text-muted-foreground">
          {plural(day.count, "episode")}
          {day.count > 0 && ` · ${formatLength(day.seconds)}`}
        </span>
      </div>
      {day.tasks.length > 0 ? (
        <ul className="mt-1.5 grid gap-1 border-t pt-1.5">
          {day.tasks.map((t) => (
            <li key={t.taskId ?? "none"} className="flex items-baseline justify-between gap-2">
              <span className="truncate">{t.name}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {t.count}
                {(t.success > 0 || t.fail > 0) && (
                  <>
                    {" "}
                    (<span className="text-ok">{t.success}</span> / <span className="text-bad">{t.fail}</span>)
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">수집한 에피소드가 없습니다.</p>
      )}
    </div>
  )
}
