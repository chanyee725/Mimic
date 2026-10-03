import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { useSimEnvs } from "@/api/simulation"

import { EnvDetail } from "./env-detail"
import { EnvList } from "./env-list"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { RegisterEnvHelp } from "./register-env-help"

/** Environments registered in the environments folder: list on the left, detail on the right */
export function EnvironmentsView() {
  const query = useSimEnvs()
  const envs = query.data ?? []
  const [selected, setSelected] = useState<string>()
  const env = envs.find((e) => e.id === selected) ?? envs[0]

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <EnvList query={query} selected={env?.id} onSelect={setSelected} />
      {env ? (
        <EnvDetail env={env} />
      ) : query.isPending ? (
        <Panel>
          <LoadingNote />
        </Panel>
      ) : query.isError ? (
        <Panel>
          <ErrorNote error={query.error} onRetry={query.refetch} />
        </Panel>
      ) : (
        <Panel className="gap-4">
          <EmptyState>등록된 환경이 없습니다. 아래처럼 폴더를 만들어 주세요.</EmptyState>
          <RegisterEnvHelp defaultOpen />
        </Panel>
      )}
    </div>
  )
}
