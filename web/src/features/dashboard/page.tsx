import { Skeleton } from "@/components/ui/skeleton"
import { Page, Panel } from "@/components/layout/page-layout"
import { QueryView } from "@/components/common/query-state"
import { StatStrip } from "@/components/common/stat-strip"
import { useDataTotals, useStation } from "@/api/station"

import { EpisodeHeatmap } from "./components/episode-heatmap"
import { TaskList } from "./components/task-list"
import { TrainingPods } from "./components/training-pods"
import { TOTAL_ICONS } from "./lib"

export function DashboardPage() {
  const { data: station } = useStation()
  const totals = useDataTotals()
  return (
    <Page fit title="Dashboard" description={station ? `${station.id} · ${station.robot} · ${station.date}` : "…"}>
      <QueryView
        query={totals}
        loading={<Skeleton className="h-[86px] shrink-0 rounded-lg" />}
        className="flex h-[86px] shrink-0 rounded-lg border px-5"
      >
        {(items) => <StatStrip items={items.map((t) => ({ ...t, icon: TOTAL_ICONS[t.key] }))} />}
      </QueryView>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TaskList />
        <div className="flex min-h-0 flex-col gap-4">
          <Panel className="shrink-0">
            <EpisodeHeatmap />
          </Panel>
          <TrainingPods />
        </div>
      </div>
    </Page>
  )
}
