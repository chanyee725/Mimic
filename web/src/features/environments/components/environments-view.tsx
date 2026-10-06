import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { useSimConfig, useSimEnvs } from "@/api/simulation"

import { rigOf, type RigFilter } from "../lib"
import { EnvDetail } from "./env-detail"
import { EnvList } from "./env-list"

/** USD environments found in the environments folder: list on the left, detail on the right */
export function EnvironmentsView({
  selected,
  onSelect,
  error,
}: {
  selected?: string
  onSelect: (id: string | undefined) => void
  /** Rescan failure, shown above the panels */
  error: unknown
}) {
  const query = useSimEnvs()
  const dir = useSimConfig().data?.envsDir
  const envs = query.data ?? []
  const [rig, setRig] = useState<RigFilter>("all")
  // The detail follows the rig filter: a hidden selection falls back to the first shown environment
  const byRig = envs.filter((e) => rig === "all" || rigOf(e) === rig)
  const env = byRig.find((e) => e.id === selected) ?? byRig[0]

  const body = query.isPending ? (
    <Panel className="flex-1">
      <LoadingNote />
    </Panel>
  ) : query.isError ? (
    <Panel className="flex-1">
      <ErrorNote error={query.error} onRetry={query.refetch} />
    </Panel>
  ) : envs.length === 0 ? (
    <Panel className="flex-1">
      <EmptyState className="grid justify-items-center gap-1 py-10">
        <span>{dir ? <span className="font-mono">{dir}</span> : "환경 폴더"} 에 USD 파일을 넣고 Rescan 하세요.</span>
        <span className="text-xs">
          Rig 전용은 <span className="font-mono">&lt;rig-id&gt;/</span> 폴더에, 썸네일은 같은 이름의 .png 로 둡니다.
        </span>
      </EmptyState>
    </Panel>
  ) : (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <EnvList envs={envs} selected={env?.id} onSelect={onSelect} rig={rig} onRigChange={setRig} />
      {env ? (
        <EnvDetail key={env.id} env={env} onDeleted={() => onSelect(undefined)} />
      ) : (
        <Panel>
          <EmptyState className="py-10">이 Rig 의 환경이 없습니다.</EmptyState>
        </Panel>
      )}
    </div>
  )

  return (
    <>
      <ErrorNote error={error} />
      {body}
    </>
  )
}
