import { Panel } from "@/components/layout/page-layout"
import { StatusDot } from "@/components/common/status-dot"
import { VideoTile } from "@/components/robot/video-tile"
import type { SimEpisode, SimJob } from "@/domain/simulation"
import { formatTimecode } from "@/lib/format"
import { cn } from "@/lib/utils"

import { episodeText } from "../lib"

const SIM_FPS = 30
const SIM_RESOLUTION = "640×480"

/** Isaac Sim replay of the selected episode, or the live rollout while running and nothing is selected */
export function RolloutViewer({
  job,
  cameras,
  episode,
  onShowLive,
}: {
  job: SimJob
  cameras: string[]
  episode?: SimEpisode
  /** Clears the selection to go back to the live rollout */
  onShowLive: () => void
}) {
  const live = job.status === "running" && !episode
  const current = job.done

  let caption: string
  if (episode) caption = episodeText(episode)
  else if (live) caption = `Episode #${current}, seed ${job.seedStart + current}, in progress`
  else if (job.status === "queued") caption = "GPU 가 비면 시작합니다."
  else caption = current ? "에피소드를 선택하면 다시 재생합니다." : "실행된 에피소드가 없습니다."

  return (
    <Panel
      title="Rollout"
      className="shrink-0"
      action={
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
          {live && (
            <StatusDot tone="info" className="text-xs">
              Live
            </StatusDot>
          )}
          <span className={cn("truncate", episode && !episode.success && "text-bad")}>{caption}</span>
          {job.status === "running" && episode && (
            <button type="button" className="shrink-0 text-foreground hover:underline" onClick={onShowLive}>
              Show live
            </button>
          )}
        </span>
      }
    >
      <div className="grid max-w-[80svh] grid-cols-2 gap-3">
        {cameras.map((cam) => (
          <VideoTile
            key={cam}
            label={live ? `${cam}, live` : cam}
            resolution={SIM_RESOLUTION}
            measuredFps={null}
            targetFps={SIM_FPS}
            timecode={episode ? formatTimecode(episode.seconds * 1000, SIM_FPS) : undefined}
            hint="Isaac Sim 영상 스트림이 연결되면 표시됩니다."
          />
        ))}
      </div>
    </Panel>
  )
}
