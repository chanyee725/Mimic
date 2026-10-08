import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { useSimConfig, useSimEnvs } from "@/api/simulation"

import { matchesRobot, type RobotFilter } from "../lib"
import { EnvDetail } from "./env-detail"
import { EnvList } from "./env-list"

export function EnvironmentsView({
  selected,
  onSelect,
  error,
}: {
  selected?: string
  onSelect: (id: string | undefined) => void
  error: unknown
}) {
  const query = useSimEnvs()
  const dir = useSimConfig().data?.envsDir
  const envs = query.data ?? []
  const [robot, setRobot] = useState<RobotFilter>("all")
  // The detail follows the robot filter: a hidden selection falls back to the first shown environment
  const byRobot = envs.filter((e) => matchesRobot(e, robot))
  const env = byRobot.find((e) => e.id === selected) ?? byRobot[0]

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
        <span>{dir ? <span className="font-mono">{dir}</span> : "환경 폴더"} 에 환경 스크립트(.py)를 넣고 Rescan 하세요.</span>
        <span className="text-xs">
          예제는 <span className="font-mono">sim/examples/envs/</span> 에 있습니다. 썸네일은 같은 이름의 .png 로 둡니다.
        </span>
      </EmptyState>
    </Panel>
  ) : (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <EnvList envs={envs} selected={env?.id} onSelect={onSelect} robot={robot} onRobotChange={setRobot} />
      {env ? (
        <EnvDetail key={env.id} env={env} onDeleted={() => onSelect(undefined)} />
      ) : (
        <Panel>
          <EmptyState className="py-10">이 로봇 태그의 환경이 없습니다.</EmptyState>
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
