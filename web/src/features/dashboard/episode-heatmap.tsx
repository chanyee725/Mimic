import { EPISODE_ACTIVITY, type DayCount } from "@/dummy/activity"
import { cn } from "@/lib/utils"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAY_LABELS: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" }

// 0 은 비어 있음, 1~4 단계는 ok 색의 농도
const LEVEL_CLASS = ["fill-muted", "fill-ok/25", "fill-ok/50", "fill-ok/75", "fill-ok"]
const LEGEND_CLASS = ["bg-muted", "bg-ok/25", "bg-ok/50", "bg-ok/75", "bg-ok"]

const CELL = 10
const GAP = 3
const STEP = CELL + GAP
const LEFT = 26 // 요일 라벨 폭
const TOP = 14 // 월 라벨 높이

function level(count: number, max: number) {
  if (count === 0) return 0
  return Math.min(4, Math.ceil((count / max) * 4))
}

/** GitHub 잔디처럼 일별 취득 에피소드를 주 단위 열로 그린다. SVG 라서 패널 폭에 맞춰 비율 그대로 늘어난다. */
export function EpisodeHeatmap({ days = EPISODE_ACTIVITY }: { days?: DayCount[] }) {
  const firstDow = new Date(`${days[0].date}T00:00:00`).getDay()
  const cells: (DayCount | null)[] = [...Array(firstDow).fill(null), ...days]
  const weeks: (DayCount | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const max = Math.max(...days.map((d) => d.count))
  const total = days.reduce((a, d) => a + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length

  // 달이 바뀌는 첫 주에만 월 라벨
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
          <span className="font-mono text-foreground">{total.toLocaleString()}</span> episodes · {activeDays} active days
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label={`${total} episodes over ${days.length} days`}>
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
                <title>{`${day.date} · ${day.count} episodes`}</title>
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
