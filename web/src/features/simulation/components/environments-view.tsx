import { useState } from "react"

import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { listSimEnvs } from "@/api/simulation"

import { EnvDetail } from "./env-detail"
import { EnvList } from "./env-list"
import { RegisterEnvHelp } from "./register-env-help"

/** Environments registered in the environments folder: list on the left, detail on the right */
export function EnvironmentsView() {
  const envs = listSimEnvs()
  const [selected, setSelected] = useState(envs[0]?.id)
  const env = envs.find((e) => e.id === selected) ?? envs[0]

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <EnvList selected={env?.id} onSelect={setSelected} />
      {env ? (
        <EnvDetail env={env} />
      ) : (
        <Panel className="gap-4">
          <EmptyState>등록된 환경이 없습니다. 아래처럼 폴더를 만들어 주세요.</EmptyState>
          <RegisterEnvHelp defaultOpen />
        </Panel>
      )}
    </div>
  )
}
