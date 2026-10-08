import { LuBookmark, LuPlay, LuSquare } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ErrorNote, QueryNote } from "@/components/common/query-state"
import { StatusDot } from "@/components/common/status-dot"
import { simAssetScene, type SimAsset, type SimAssetKind } from "@/domain/simulation"

import { useTeleopFlow } from "../hooks/use-teleop-flow"
import { KIND_NOUN } from "../lib"
import { IsaacStatus } from "./isaac-status"
import { LeaderPicker } from "./leader-picker"
import { TeleopSession } from "./teleop-session"

export function TeleopDialog({
  kind,
  asset,
  open,
  onOpenChange,
}: {
  kind: SimAssetKind
  asset: SimAsset
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const flow = useTeleopFlow(kind, asset, open)
  const { current, active, other } = flow
  // A finished session stays visible (with its error) until the next start
  const shown = current && (active || flow.mine(current)) ? current : null
  const robot = kind === "robot"
  const supported = robot && asset.teleop.length > 0

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
            Teleoperation · <span className="font-mono">{asset.id}</span>
          </DialogTitle>
          <DialogDescription>
            {robot
              ? "실제 리더 팔이나 키보드로 Isaac Sim 에 연 이 로봇을 움직입니다. 리더 팔은 연결 테스트에 성공하면 시작합니다."
              : "키보드로 Isaac Sim 에 연 이 도구의 관절을 움직입니다."}{" "}
            창을 닫아도 계속 실행되며, Stop 하면 연결만 끊고 Isaac Sim 장면은 열어 둡니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 content-start gap-4 overflow-y-auto">
          <IsaacStatus scene={simAssetScene(kind, asset.id)} />

          {other && (
            <p className="text-[13px] text-muted-foreground">
              다른 {KIND_NOUN[other.kind]} <span className="font-mono">{other.robotId}</span> 의 원격 조작이 실행 중입니다. Stop 한 뒤
              시작하세요.
            </p>
          )}
          {shown && <TeleopSession session={shown} />}

          {!active && (
            <section className="grid gap-2">
              <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold">
                Leader
                <span className="font-mono text-xs font-normal text-muted-foreground">{["keyboard", ...asset.teleop].join(", ")}</span>
              </h3>
              {robot && <QueryNote query={flow.devices} />}
              <LeaderPicker
                leaders={flow.leaders}
                fits={flow.fits}
                keyboard={flow.keyboard}
                value={flow.leader?.id}
                onChange={flow.pick}
                disabled={flow.starting}
                testing={flow.testing}
                check={flow.check}
                onTest={() => flow.leader && flow.runTest(flow.leader.id)}
              />
              {robot && !supported && (
                <p className="text-xs text-muted-foreground">이 로봇을 움직일 리더 장치 종류가 없어 키보드로 움직입니다.</p>
              )}
            </section>
          )}

          {supported && (
            <p className="text-xs text-muted-foreground">
              Align leader 는 리더 팔을 이 로봇의 초기 자세(SO-101 은 접힌 자세)와 같은 자세에 두고 누릅니다. 그때 읽은 값을 기준으로 리더
              각도를 시뮬레이션 각도에 맞춥니다 (robot.yaml leader.rest). 다음 Start 부터 적용됩니다.
            </p>
          )}
          {flow.captured && (
            <StatusDot tone="ok" className="min-w-0 text-[13px] text-muted-foreground">
              <span className="min-w-0 font-mono text-xs [overflow-wrap:anywhere]">
                Saved:{" "}
                {Object.entries(flow.captured)
                  .map(([j, v]) => `${j} ${v.toFixed(1)}`)
                  .join(", ")}
              </span>
            </StatusDot>
          )}
          <ErrorNote error={flow.error ?? flow.session.error} />
        </div>

        <DialogFooter>
          {supported && (
            <Button variant="outline" className="sm:mr-auto" disabled={!flow.canCapture} onClick={flow.capture}>
              <LuBookmark />
              {flow.capturing ? "Saving…" : "Align leader"}
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {active ? (
            <Button disabled={flow.stopping} onClick={flow.stop}>
              <LuSquare />
              {flow.stopping ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            <Button disabled={!flow.canStart} onClick={flow.start}>
              <LuPlay />
              {flow.starting ? "Starting…" : "Start"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
