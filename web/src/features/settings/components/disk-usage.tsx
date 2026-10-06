import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { useDiskUsage } from "@/api/settings"
import { diskUsedPct } from "@/domain/settings"
import { cn } from "@/lib/utils"

/** GiB with sensible precision: 1,234 / 56.7 / 0.42 */
const gib = (gb: number) => (gb >= 100 ? Math.round(gb).toLocaleString() : gb >= 10 ? gb.toFixed(1) : gb.toFixed(2))

const PART_COLOR: Record<string, string> = {
  raw: "bg-series-1",
  datasets: "bg-series-3",
  models: "bg-series-4",
  other: "bg-muted-foreground/40",
}

/** Read-only disk bar for the station data folder (recordings, datasets, models) */
export function DiskUsage() {
  const query = useDiskUsage()
  const disk = query.data
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />
  if (!disk) return <LoadingNote className="py-2" />
  const used = disk.parts.reduce((a, p) => a + p.gb, 0)
  const free = Math.max(0, disk.totalGB - used)
  const pct = diskUsedPct(disk)
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between text-[13px] tabular-nums">
        <span>
          {gib(used)} GB{" "}
          <span className="text-muted-foreground">
            of {gib(disk.totalGB)} GB used, {gib(free)} GB free
          </span>
        </span>
        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct.toFixed(0)}% of disk used`}>
        {disk.parts.map((p) => (
          <span key={p.key} className={PART_COLOR[p.key]} style={{ width: `${disk.totalGB > 0 ? (p.gb / disk.totalGB) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
        {disk.parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-sm", PART_COLOR[p.key])} />
            {p.label} {gib(p.gb)} GB
          </span>
        ))}
      </div>
    </div>
  )
}
