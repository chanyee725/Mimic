import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { useSimConfig, useSimEnvs } from "@/api/simulation"

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
  const env = envs.find((e) => e.id === selected) ?? envs[0]

  const body = query.isPending ? (
    <Panel className="flex-1">
      <LoadingNote />
    </Panel>
  ) : query.isError ? (
    <Panel className="flex-1">
      <ErrorNote error={query.error} onRetry={query.refetch} />
    </Panel>
  ) : !env ? (
    <Panel className="flex-1">
      <EmptyState className="py-10">
        {dir ? <span className="font-mono">{dir}</span> : "환경 폴더"} 에 USD 파일을 넣고 Rescan 하세요.
      </EmptyState>
    </Panel>
  ) : (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <EnvList envs={envs} selected={env.id} onSelect={onSelect} />
      <EnvDetail key={env.id} env={env} onDeleted={() => onSelect(undefined)} />
    </div>
  )

  return (
    <>
      <ErrorNote error={error} />
      {body}
    </>
  )
}
