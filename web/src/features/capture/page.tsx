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

  // 작업자는 양손으로 leader 암을 잡고 있으므로 키보드 / 풋 페달 입력이 기본
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
      {/* Live — 좌 7 : 우 3. 좌측은 카메라 2대를 크게, 아래에 Action / Observation 그래프 */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {/* 카메라가 남은 높이를 채우고, 그래프는 고정 높이 */}
          <CameraGrid
            cameras={cameras}
            recording={recording}
            timecode={recording ? formatTimecode(ep.elapsedMs, task.videoFps) : undefined}
          />

          {/* Rerun time series 처럼 joint 별 플롯. 바깥 패널 없이 플롯 칸에만 테두리 */}
          <JointPlots joints={rig.joints} hz={task.actionHz} actionSource={rig.master} stateSource={rig.slave} className="h-64 shrink-0" />
        </div>

        <ControlPanel task={task} ep={ep} onSelectTask={setTaskId} />
      </div>
    </Page>
  )
}
