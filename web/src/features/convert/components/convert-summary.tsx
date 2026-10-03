import { EmptyState } from "@/components/common/empty-state"
import type { ConvertPreview } from "@/domain/dataset"
import { formatDate, formatLength, formatSize } from "@/lib/format"

/** Summary of the episodes to convert (from the server preview). Same layout regardless of episode count */
export function ConvertSummary({ preview }: { preview: ConvertPreview }) {
  if (preview.episodes === 0) return <EmptyState>변환할 에피소드를 선택하세요.</EmptyState>

  const from = formatDate(preview.recordedFrom)
  const to = formatDate(preview.recordedTo)
  const summary = [
    { k: "Frames", v: preview.frames.toLocaleString() },
    { k: "Length", v: formatLength(preview.lengthS) },
    { k: "Avg episode", v: `${(preview.lengthS / preview.episodes).toFixed(1)} s` },
    { k: "Recorded", v: from === to ? from : `${from} – ${to}` },
    // Rough estimate assuming AV1 re-encoding
    { k: "Est. output", v: `~${formatSize(preview.estOutputMB)}`, sub: `MCAP ${formatSize(preview.mcapMB)}` },
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
