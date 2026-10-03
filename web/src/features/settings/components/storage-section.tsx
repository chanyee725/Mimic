import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { SettingsGroup, SettingsSection } from "@/components/common/settings-section"
import { useDiskUsage } from "@/api/settings"
import { diskUsedPct } from "@/domain/settings"
import { cn } from "@/lib/utils"

import { useSettingsDraft } from "../hooks/use-draft"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { SectionPending } from "./section-pending"
import { SaveBar } from "./save-bar"
import { SettingRow } from "./setting-row"

const PART_COLOR: Record<string, string> = {
  raw: "bg-series-1",
  datasets: "bg-series-3",
  models: "bg-series-4",
  other: "bg-muted-foreground/40",
}

function DiskUsage({ warnAtPct }: { warnAtPct: number }) {
  const query = useDiskUsage()
  const disk = query.data
  if (query.isError) return <ErrorNote error={query.error} onRetry={() => void query.refetch()} />
  if (!disk) return <LoadingNote className="py-2" />
  const used = disk.parts.reduce((a, p) => a + p.gb, 0)
  const pct = diskUsedPct(disk)
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between text-[13px] tabular-nums">
        <span>
          {used.toLocaleString()} GB <span className="text-muted-foreground">of {disk.totalGB.toLocaleString()} GB used</span>
        </span>
        <span className={cn(pct >= warnAtPct ? "text-warn" : "text-muted-foreground")}>{pct.toFixed(0)}%</span>
      </div>
      <div className="relative flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${pct.toFixed(0)}% of disk used`}>
        {disk.parts.map((p) => (
          <span key={p.key} className={PART_COLOR[p.key]} style={{ width: `${(p.gb / disk.totalGB) * 100}%` }} />
        ))}
        <span className="absolute inset-y-0 w-px bg-warn" style={{ left: `${warnAtPct}%` }} title={`Warn at ${warnAtPct}%`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
        {disk.parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-sm", PART_COLOR[p.key])} />
            {p.label} {p.gb} GB
          </span>
        ))}
      </div>
    </div>
  )
}

export function StorageSection() {
  const { query, draft, set, saveBar } = useSettingsDraft("storage")
  if (!draft) return <SectionPending query={query} />
  const path = (key: "rawPath" | "datasetsPath" | "modelsPath", label: string, hint: string) => (
    <SettingRow label={label} hint={hint} htmlFor={`st-${key}`}>
      <Input id={`st-${key}`} className="h-8 font-mono text-[13px]" value={draft[key]} onChange={(e) => set(key, e.target.value)} />
    </SettingRow>
  )

  return (
    <SettingsGroup className="@container">
      <SettingsSection title="Disk">
        <DiskUsage warnAtPct={draft.warnAtPct} />
        <SettingRow label="Warn when disk is" htmlFor="st-warn">
          <Input
            id="st-warn"
            className="h-8 w-20 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            value={draft.warnAtPct}
            onChange={(e) => set("warnAtPct", Math.min(100, Number(e.target.value) || 0))}
          />
          <span className="text-xs text-muted-foreground">% full</span>
        </SettingRow>
      </SettingsSection>
      <SettingsSection title="Folders">
        {path("rawPath", "Raw recordings", "Capture 가 저장하는 MCAP 파일")}
        {path("datasetsPath", "Datasets", "Convert 로 만든 LeRobot 데이터셋")}
        {path("modelsPath", "Models", "Models 에 저장한 checkpoint")}
      </SettingsSection>
      <SettingsSection title="Cleanup">
        <SettingRow
          label="Delete rejected episodes"
          hint="Review 에서 Reject 한 MCAP 파일을 정해진 날짜가 지나면 지웁니다"
          htmlFor="st-del"
        >
          <Input
            aria-label="Days before deleting"
            className="h-8 w-16 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            disabled={!draft.deleteRejected}
            value={draft.deleteRejectedAfterDays}
            onChange={(e) => set("deleteRejectedAfterDays", Number(e.target.value) || 0)}
          />
          <span className="text-xs text-muted-foreground">days</span>
          <Switch id="st-del" checked={draft.deleteRejected} onCheckedChange={(v) => set("deleteRejected", v)} />
        </SettingRow>
        <SettingRow
          label="Checkpoints kept per training"
          hint="오래된 것부터 지웁니다. Models 에 저장한 것은 지우지 않습니다"
          htmlFor="st-keep"
        >
          <Input
            id="st-keep"
            className="h-8 w-16 text-right text-[13px] tabular-nums"
            inputMode="numeric"
            value={draft.keepCheckpoints}
            onChange={(e) => set("keepCheckpoints", Number(e.target.value) || 0)}
          />
        </SettingRow>
      </SettingsSection>
      <SaveBar {...saveBar} />
    </SettingsGroup>
  )
}
