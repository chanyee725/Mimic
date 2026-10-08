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

const poseRow = (k: string, pose: Record<string, number> | null, none: string) => ({
  k,
  v: pose ? (
    <span className="font-mono text-xs [overflow-wrap:anywhere]">
      {Object.entries(pose)
        .map(([j, v]) => `${j} ${v.toFixed(1)}`)
        .join(", ")}
    </span>
  ) : (
    <span className="text-muted-foreground">{none}</span>
  ),
})

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
          poseRow("Initial pose", asset.initialPose, "None (robot.yaml)"),
          poseRow("Leader rest", asset.leaderRest, "None (Teleoperation → Align leader)"),
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
          <Button variant="outline" size="sm" onClick={() => setTeleop(true)}>
            <LuGamepad2 />
            Teleoperation
          </Button>
        </div>
      </div>

      <div className="grid gap-1">
        <IsaacStatus scene={simAssetScene(kind, asset.id)} />
        <ErrorNote error={open.error} />
      </div>

      <section className="grid content-start gap-2">
        <h3 className="text-sm font-semibold">Details</h3>
        <DetailList rows={details} bordered />
      </section>
      <EnvFiles files={asset.files} />
      {/* Mounted only while open so every opening starts with a fresh connection test */}
      {teleop && <TeleopDialog kind={kind} asset={asset} open onOpenChange={setTeleop} />}
    </Panel>
  )
}
