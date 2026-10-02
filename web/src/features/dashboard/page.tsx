import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { DATA_TOTALS, STATION } from "@/dummy/station"

import { EpisodeHeatmap } from "./components/episode-heatmap"
import { TaskList } from "./components/task-list"
import { TrainingPods } from "./components/training-pods"
import { TOTAL_ICONS } from "./lib"

export function DashboardPage() {
  return (
    <Page fit title="Dashboard" description={`${STATION.id} · ${STATION.robot} · ${STATION.date}`}>
      <StatStrip items={DATA_TOTALS.map((t) => ({ ...t, icon: TOTAL_ICONS[t.key] }))} />

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
