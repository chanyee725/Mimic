import { EmptyState } from "@/components/common/empty-state"
import type { Recording } from "@/dummy/recordings"
import { formatLength, formatSize } from "@/lib/format"

/** Summary of the episodes to convert. Same layout regardless of episode count */
export function ConvertSummary({ targets, fps }: { targets: Recording[]; fps: number }) {
  if (targets.length === 0) return <EmptyState>변환할 에피소드를 선택하세요.</EmptyState>

  const lens = targets.map((r) => r.durationS)
  const totalS = lens.reduce((a, b) => a + b, 0)
  const totalMB = targets.reduce((a, r) => a + r.sizeMB, 0)
  const dates = targets.map((r) => r.recordedAt.slice(5, 10)).sort()
  const summary = [
    { k: "Frames", v: Math.round(totalS * fps).toLocaleString() },
    { k: "Length", v: formatLength(totalS) },
    {
      k: "Avg episode",
      v: `${(totalS / targets.length).toFixed(1)} s`,
      sub: `${lens.reduce((a, b) => Math.min(a, b)).toFixed(1)} – ${lens.reduce((a, b) => Math.max(a, b)).toFixed(1)} s`,
    },
    { k: "Recorded", v: dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}` },
    // Rough estimate assuming AV1 re-encoding
    { k: "Est. output", v: `~${formatSize(totalMB * 0.6)}`, sub: `MCAP ${formatSize(totalMB)}` },
  ]

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 @md:grid-cols-3 @2xl:grid-cols-5">
      {summary.map((m) => (
        <div key={m.k} className="grid content-start gap-0.5">
          <dt className="text-xs text-muted-foreground">{m.k}</dt>
          <dd className="text-[13px] whitespace-nowrap tabular-nums">
            {m.v}
            {m.sub && <span className="block text-xs text-muted-foreground">{m.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
