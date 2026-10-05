import { Skeleton } from "@/components/ui/skeleton"
import { QueryView } from "@/components/common/query-state"
import { useEpisodeActivity } from "@/api/station"
import type { DayCount } from "@/domain/activity"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

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

  // Month label only on the first week of each month
  const monthLabels = weeks.map((w, i) => {
    const first = w.find(Boolean)
    const prev = i > 0 ? weeks[i - 1].find(Boolean) : null
    if (!first) return ""
    const m = Number(first.date.slice(5, 7)) - 1
    return !prev || Number(prev.date.slice(5, 7)) - 1 !== m ? MONTHS[m] : ""
  })

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

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${total} episodes over ${days.length} days`}
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
                className={LEVEL_CLASS[level(day.count, max)]}
              >
                <title>{`${day.date} · ${plural(day.count, "episode")}`}</title>
              </rect>
            ) : null,
          ),
        )}
      </svg>

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
