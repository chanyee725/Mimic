import { LuPlay, LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, QueryNote } from "@/components/common/query-state"
import { simAssetScene, type SimAsset } from "@/domain/simulation"

import { useTeleopFlow } from "../hooks/use-teleop-flow"
import { IsaacStatus } from "./isaac-status"
import { LeaderPicker } from "./leader-picker"
import { TeleopSession } from "./teleop-session"

/** Drive a robot opened alone in Isaac Sim with a real leader arm: pick → test → start → watch → stop */
export function TeleopDialog({ robot, open, onOpenChange }: { robot: SimAsset; open: boolean; onOpenChange: (open: boolean) => void }) {
  const flow = useTeleopFlow(robot, open)
  const { current, active, other } = flow
  // A finished session stays visible (with its error) until the next start
  const shown = current && (active || current.robotId === robot.id) ? current : null
  const supported = robot.teleop.length > 0

  const close = () => {
    // The session keeps running after the dialog closes; Stop ends it
    flow.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Teleoperation · <span className="font-mono">{robot.id}</span>
          </DialogTitle>
          <DialogDescription>
            실제 리더 팔로 Isaac Sim 에 연 이 로봇을 움직입니다. 연결할 리더 장치를 고르고 연결 테스트에 성공하면 시작합니다. 창을 닫아도
            계속 실행되며, Stop 하면 리더 연결만 끊고 Isaac Sim 장면은 열어 둡니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 content-start gap-4 overflow-y-auto">
          <IsaacStatus scene={simAssetScene("robot", robot.id)} />

          {other && (
            <p className="text-[13px] text-muted-foreground">
              다른 로봇(<span className="font-mono">{other.robotId}</span>)을 원격 조작하는 중입니다. Stop 한 뒤 시작하세요.
            </p>
          )}
          {shown && <TeleopSession session={shown} />}

          {!supported ? (
            <EmptyState className="py-6">이 로봇을 움직일 리더 장치 종류가 없습니다.</EmptyState>
          ) : (
            !active && (
              <section className="grid gap-2">
                <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold">
                  Leader
                  <span className="font-mono text-xs font-normal text-muted-foreground">{robot.teleop.join(", ")}</span>
                </h3>
                <QueryNote query={flow.devices} />
                {flow.devices.data && flow.leaders.length === 0 && (
                  <EmptyState className="py-6">등록된 리더 장치가 없습니다. Rig 설정 파일에 리더 장치를 추가하세요.</EmptyState>
                )}
                {flow.leaders.length > 0 && (
                  <LeaderPicker
                    leaders={flow.leaders}
                    value={flow.leader?.id}
                    onChange={flow.pick}
                    disabled={flow.starting}
                    testing={flow.testing}
                    check={flow.check}
                    onTest={() => flow.leader && flow.runTest(flow.leader.id)}
                  />
                )}
              </section>
            )
          )}

          <ErrorNote error={flow.error ?? flow.session.error} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {active ? (
            <Button disabled={flow.stopping} onClick={flow.stop}>
              <LuSquare />
              {flow.stopping ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            supported && (
              <Button disabled={!flow.canStart} onClick={flow.start}>
                <LuPlay />
                {flow.starting ? "Starting…" : "Start"}
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
