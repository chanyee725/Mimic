import { useState } from "react"

import { Page } from "@/components/app/page"
import { JointPlots } from "@/components/robot/joint-plots"
import { devicesOf } from "@/dummy/devices"
import { getRig } from "@/dummy/rigs"
import { TASKS } from "@/dummy/tasks"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { formatTimecode } from "@/lib/format"

import { CameraGrid } from "./components/camera-grid"
import { ControlPanel } from "./components/control-panel"
import { useEpisode } from "./hooks/use-episode"

export function CapturePage() {
  const [taskId, setTaskId] = useState(TASKS[0].id)
  const task = TASKS.find((t) => t.id === taskId) ?? TASKS[0]
  const rig = getRig(task.rigId)

  const ep = useEpisode({
    durationS: task.durationS,
    startEpisode: task.collected + 1,
    subtasksTotal: task.subtasks.length,
    actionHz: task.actionHz,
    videoFps: task.videoFps,
  })
  const { phase, toggle, save, start, discard, setSubtask } = ep

  const cameras = devicesOf(rig.id).filter((d) => d.type === "camera")

  // The operator holds the leader arm with both hands, so keyboard / foot pedal input is the default
  useHotkeys((e) => {
    if (e.code === "Space") {
      toggle()
      return true
    }
    if (e.key === "ArrowRight") save("success")
    else if (e.key === "f" || e.key === "F") save("fail")
    else if (e.key === "p" || e.key === "P") save("partial")
    else if (e.key === "ArrowLeft") {
      if (phase !== "idle") start()
    } else if (e.key === "Escape") discard()
    else if (phase === "recording") {
      const idx = task.subtasks.findIndex((s) => s.key === e.key)
      if (idx >= 0) setSubtask(idx)
    }
  })

  const recording = phase === "recording"

  return (
    <Page
      fit
      title="Capture"
      description={`${rig.name}: ${rig.master} drives ${rig.slave}. Action ${task.actionHz} Hz, video ${task.videoFps} fps.`}
    >
      {/* Live: 7 : 3 split. Left shows both cameras large with action / observation plots below */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {/* Cameras fill the remaining height; plots have a fixed height */}
          <CameraGrid
            cameras={cameras}
            recording={recording}
            timecode={recording ? formatTimecode(ep.elapsedMs, task.videoFps) : undefined}
          />

          {/* Per-joint plots like Rerun time series. No outer panel, only plot cells are bordered */}
          <JointPlots joints={rig.joints} hz={task.actionHz} actionSource={rig.master} stateSource={rig.slave} className="h-64 shrink-0" />
        </div>

        <ControlPanel task={task} ep={ep} onSelectTask={setTaskId} />
      </div>
    </Page>
  )
}
