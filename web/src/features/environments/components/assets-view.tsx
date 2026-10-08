import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { useSimEnvs, useSimRobots, useSimTools } from "@/api/simulation"
import type { SimAssetKind } from "@/domain/simulation"

import { AssetDetail } from "./asset-detail"
import { AssetList } from "./asset-list"

const DIR: Record<SimAssetKind, string> = { robot: "data/sims/robots/", tool: "data/sims/tools/" }

/** Robot or tool USDs: list on the left, detail on the right */
export function AssetsView({ kind }: { kind: SimAssetKind }) {
  const robots = useSimRobots()
  const tools = useSimTools()
  const query = kind === "robot" ? robots : tools
  const envs = useSimEnvs().data ?? []
  const [selected, setSelected] = useState<string>()
  const assets = query.data ?? []
  const asset = assets.find((a) => a.id === selected) ?? assets[0]
  const taggedWith = (id: string) => envs.filter((e) => e.robots.includes(id))

  if (query.isPending)
    return (
      <Panel className="flex-1">
        <LoadingNote />
      </Panel>
    )
  if (query.isError)
    return (
      <Panel className="flex-1">
        <ErrorNote error={query.error} onRetry={query.refetch} />
      </Panel>
    )
  if (!asset)
    return (
      <Panel className="flex-1">
        <EmptyState className="grid justify-items-center gap-1 py-10">
          <span>
            <span className="font-mono">{DIR[kind]}</span> 에 USD 를 넣으세요.
          </span>
          <span className="text-xs">
            <span className="font-mono">&lt;id&gt;.usd</span> 하나, 또는 하위 파일이 있으면{" "}
            <span className="font-mono">&lt;id&gt;/&lt;id&gt;.usd</span> 폴더로 둡니다.
          </span>
        </EmptyState>
      </Panel>
    )

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <AssetList
        title={kind === "robot" ? "Robots" : "Tools"}
        dir={DIR[kind]}
        assets={assets}
        selected={asset.id}
        onSelect={setSelected}
        envCount={kind === "robot" ? (id) => taggedWith(id).length : undefined}
      />
      <AssetDetail key={asset.id} kind={kind} asset={asset} envs={kind === "robot" ? taggedWith(asset.id) : undefined} />
    </div>
  )
}
