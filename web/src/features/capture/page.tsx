import { useState } from "react"

import { Page, Panel } from "@/components/layout/page-layout"
import { JointPlots } from "@/components/robot/joint-plots"
import { useCaptureState } from "@/api/capture"
import { useRigDevices } from "@/api/devices"
import { useRig } from "@/api/rigs"
import { useCurrentTask, useSetCurrentTask } from "@/api/station"
import { useTasks } from "@/api/tasks"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { formatTimecode } from "@/lib/format"

import { CameraGrid } from "./components/camera-grid"
import { ControlPanel } from "./components/control-panel"
import { QueryNote } from "@/components/common/query-state"
import { useCapture } from "./hooks/use-capture"

export function CapturePage() {
  const tasks = useTasks()
  const current = useCurrentTask()
  const setCurrent = useSetCurrentTask()
  const capture = useCaptureState()
  const [picked, setPicked] = useState<string | null>(null)

  // While an episode is in progress the station's task wins; otherwise the local pick, then the station's current task
  const busyTaskId = capture.data && capture.data.phase !== "idle" ? capture.data.taskId : null
  const list = tasks.data ?? []
  const wanted = busyTaskId ?? picked ?? current.data?.taskId
  const task = list.find((t) => t.id === wanted) ?? list[0]

  const ep = useCapture(task)
  const rig = useRig(task?.rigId)
  const devices = useRigDevices(rig.data?.id)
  const cameras = (devices.data ?? []).filter((d) => d.type === "camera")

  const selectTask = (id: string) => {
    setPicked(id)
    setCurrent.mutate(id)
  }

  // The operator holds the leader arm with both hands, so keyboard / foot pedal input is the default
  useHotkeys((e) => {
    if (e.code === "Space") {
      ep.toggle()
      return true
    }
    if (e.key === "ArrowRight") ep.save("success")
    else if (e.key === "f" || e.key === "F") ep.save("fail")
    else if (e.key === "p" || e.key === "P") ep.save("partial")
    else if (e.key === "ArrowLeft") ep.rerecord()
    else if (e.key === "Escape") ep.discard()
    else if (ep.phase === "recording" && task) {
      const idx = task.subtasks.findIndex((s) => s.key === e.key)
      if (idx >= 0) ep.setSubtask(idx)
    }
  })

  const recording = ep.phase === "recording"
  const r = rig.data

  return (
    <Page
      fit
      title="Capture"
      description={
        r && task
          ? `${r.name}: ${r.master} drives ${r.slave}. Action ${task.actionHz} Hz, video ${task.videoFps} fps.`
          : "리더 암으로 팔로워를 조종하며 에피소드를 녹화합니다."
      }
    >
      {/* Live: 7 : 3 split. Left shows both cameras large with action / observation plots below */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
          {/* Cameras fill the remaining height; plots have a fixed height */}
          <CameraGrid
            cameras={cameras}
            loading={<QueryNote query={task ? devices : tasks} />}
            recording={recording}
            timecode={recording && task ? formatTimecode(ep.elapsedS * 1000, task.videoFps) : undefined}
          />

          {/* Per-joint plots like Rerun time series. No outer panel, only plot cells are bordered */}
          {r && task ? (
            <JointPlots joints={r.joints} hz={task.actionHz} actionSource={r.master} stateSource={r.slave} className="h-64 shrink-0" />
          ) : (
            <div className="grid h-64 shrink-0 place-items-center rounded-lg border">
              <QueryNote query={task ? rig : tasks} />
            </div>
          )}
        </div>

        {task ? (
          <ControlPanel task={task} ep={ep} onSelectTask={selectTask} taskError={setCurrent.error} />
        ) : (
          <Panel>
            <QueryNote query={tasks} />
            {tasks.data?.length === 0 && <p className="text-[13px] text-muted-foreground">등록된 Task 가 없습니다.</p>}
          </Panel>
        )}
      </div>
    </Page>
  )
}
