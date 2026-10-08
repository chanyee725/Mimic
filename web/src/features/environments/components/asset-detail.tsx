import { useState } from "react"
import { LuEye, LuGamepad2 } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Panel } from "@/components/layout/page-layout"
import { DetailList } from "@/components/common/detail-list"
import { ErrorNote } from "@/components/common/query-state"
import { useOpenSimAsset } from "@/api/simulation"
import { simAssetScene, type SimAsset, type SimAssetKind, type SimEnv } from "@/domain/simulation"
import { formatDateTime } from "@/lib/format"

import { formatKB } from "../lib"
import { EnvFiles } from "./env-files"
import { IsaacStatus } from "./isaac-status"
import { TeleopDialog } from "./teleop-dialog"

const HINT: Record<SimAssetKind, string> = {
  robot:
    "View 는 빈 장면의 원점에 이 로봇만 놓고 base 를 바닥에 고정해 Isaac Sim 에서 엽니다. Stage 창에서 USD 구조를, Physics Inspector 로 관절을 확인합니다. Teleoperation 은 같은 장면을 열고 실제 리더 팔로 로봇을 움직입니다.",
  tool: "View 는 빈 장면에 이 도구만 바닥에서 0.3 m 위에 고정해 Isaac Sim 에서 엽니다. 아직 로봇 팔 끝에 붙이지는 않습니다.",
}

/** Right-hand robot / tool detail: root USD, files, environments tagged with it; View in Isaac Sim and (robots) Teleoperation */
export function AssetDetail({ kind, asset, envs }: { kind: SimAssetKind; asset: SimAsset; envs?: SimEnv[] }) {
  const open = useOpenSimAsset()
  const [teleop, setTeleop] = useState(false)
  const root = asset.files.length > 1 ? asset.path.split("/").slice(-2).join("/") : asset.path.split("/").pop()
  const details = [
    { k: "Root USD", v: <span className="font-mono">{root}</span> },
    { k: "Size", v: formatKB(asset.sizeKB) },
    { k: "Files", v: asset.files.length.toLocaleString() },
    ...(envs
      ? [
          {
            k: "Environments",
            v: envs.length ? envs.map((e) => e.name).join(", ") : <span className="text-muted-foreground">None</span>,
          },
        ]
      : []),
    ...(kind === "robot"
      ? [
          {
            k: "Initial pose",
            v: asset.initialPose ? (
              <span className="font-mono text-xs [overflow-wrap:anywhere]">
                {Object.entries(asset.initialPose)
                  .map(([j, v]) => `${j} ${v.toFixed(1)}`)
                  .join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground">None (robot.yaml)</span>
            ),
          },
        ]
      : []),
    { k: "Updated", v: formatDateTime(asset.updatedAt) },
  ]

  return (
    <Panel className="min-h-0 gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 basis-80 gap-1">
          <h2 className="truncate font-mono text-lg font-semibold">{asset.id}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground" title={asset.path}>
            {asset.path}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={open.isPending} onClick={() => open.mutate({ kind, id: asset.id })}>
            <LuEye />
            {open.isPending ? "Opening…" : "View"}
          </Button>
          {kind === "robot" && (
            <Button variant="outline" size="sm" onClick={() => setTeleop(true)}>
              <LuGamepad2 />
              Teleoperation
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-1">
        <p className="text-xs text-muted-foreground">{HINT[kind]}</p>
        <IsaacStatus scene={simAssetScene(kind, asset.id)} />
        <ErrorNote error={open.error} />
      </div>

      <section className="grid content-start gap-2">
        <h3 className="text-sm font-semibold">Details</h3>
        <DetailList rows={details} bordered />
      </section>
      <EnvFiles files={asset.files} />
      {/* Mounted only while open so every opening starts with a fresh connection test */}
      {teleop && <TeleopDialog robot={asset} open onOpenChange={setTeleop} />}
    </Panel>
  )
}
