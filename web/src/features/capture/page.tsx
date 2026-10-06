import { useEffect, useRef, useState } from "react"

import { Page, Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { QueryNote } from "@/components/common/query-state"
import { LinkButton } from "@/components/common/link-button"
import { CameraGrid } from "@/components/robot/camera-grid"
import { JointPlots } from "@/components/robot/joint-plots"
import { useCaptureState } from "@/api/capture"
import { usePorts, useRigDevices } from "@/api/devices"
import { getTeleopSamples, useRig, useTeleopStatus, useTestRig } from "@/api/rigs"
import { useCurrentTask, useSetCurrentTask } from "@/api/station"
import { useTasks } from "@/api/tasks"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useLiveSamples } from "@/hooks/use-live-samples"
import { formatTimecode } from "@/lib/format"

import { ControlPanel } from "./components/control-panel"
import { useCapture } from "./hooks/use-capture"
import { offlineDevices, targetReached } from "./lib"

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

  const rig = useRig(task?.rigId)
  const devices = useRigDevices(rig.data?.id)
  const cameras = (devices.data ?? []).filter((d) => d.type === "camera")
  const offline = offlineDevices(devices.data ?? [])
  // An Isaac Sim task records in its environment, which is not connected yet
  const simEnv = task?.envId ?? null
  const ep = useCapture(task, { startBlocked: !!simEnv || offline.length > 0 || (!!task && targetReached(task)) })

  // Devices start "off" after a backend restart: test the rig once when Capture opens with some of them off
  const { mutate: testRig, isPending: testing } = useTestRig()
  const tested = useRef(new Set<string>())
  const rigId = rig.data?.id
  const needsTest = offline.length > 0
  useEffect(() => {
    if (!rigId || !needsTest || tested.current.has(rigId)) return
    tested.current.add(rigId)
    testRig(rigId)
  }, [rigId, needsTest, testRig])
  const ports = usePorts()
  const livePorts = new Set((ports.data ?? []).filter((p) => p.kind === "video").flatMap((p) => [p.path, p.device]))
  const teleop = useTeleopStatus(rig.data?.id)
  const samples = useLiveSamples(rig.data?.id, !!teleop.data?.running, getTeleopSamples)

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
          {/* Cameras keep the video's shape; plots take the rest */}
          <CameraGrid
            cameras={cameras}
            // The test opens each camera: start previews after it so they don't fight over the device
            livePorts={testing ? new Set<string>() : livePorts}
            empty={
              !task ? (
                tasks.data ? (
                  <span className="text-xs text-muted-foreground">Task 를 만들면 Rig 카메라가 여기에 표시됩니다.</span>
                ) : (
                  <QueryNote query={tasks} />
                )
              ) : rig.error ? (
                <QueryNote query={rig} />
              ) : devices.data ? undefined : (
                <QueryNote query={devices} />
              )
            }
            timecode={recording && task ? formatTimecode(ep.elapsedS * 1000, task.videoFps) : undefined}
          />

          {/* Per-joint plots like Rerun time series. No outer panel, only plot cells are bordered */}
          {r && task ? (
            <JointPlots
              joints={r.joints}
              hz={task.actionHz}
              actionSource={r.master}
              stateSource={r.slave}
              data={samples}
              hint="teleop 이 켜지면 leader / follower 관절값이 표시됩니다."
              // Takes the height the cameras leave
              className="min-h-64 flex-1"
            />
          ) : (
            <div className="grid h-64 shrink-0 place-items-center rounded-lg border">
              {!task && tasks.data ? (
                <span className="text-xs text-muted-foreground">Task 를 만들면 관절값 그래프가 여기에 표시됩니다.</span>
              ) : (
                <QueryNote query={task ? rig : tasks} />
              )}
            </div>
          )}
        </div>

        {task ? (
          <ControlPanel
            task={task}
            ep={ep}
            offline={offline.map((d) => d.name)}
            simEnv={simEnv}
            onSelectTask={selectTask}
            taskError={setCurrent.error}
          />
        ) : (
          <Panel>
            <QueryNote query={tasks} />
            {tasks.data?.length === 0 && (
              <EmptyState className="grid justify-items-center gap-3 py-10">
                등록된 Task 가 없습니다. Tasks 에서 Task 를 만든 뒤 녹화하세요.
                <LinkButton to="/tasks" variant="outline" size="sm">
                  Open Tasks
                </LinkButton>
              </EmptyState>
            )}
          </Panel>
        )}
      </div>
    </Page>
  )
}
