import { useState } from "react"

import { Page, Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { useModels } from "@/api/models"

import { ModelDetail } from "./components/model-detail"
import { ModelList } from "./components/model-list"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"

export function ModelsPage() {
  const query = useModels()
  const models = query.data ?? []
  const [selected, setSelected] = useState<string>()
  // Falls back to the newest model (also after the selected one is deleted)
  const model = models.find((m) => m.id === selected) ?? models[0]

  return (
    <Page fit title="Models" description="학습에서 저장한 checkpoint 를 모델로 모아 보고, 평가하거나 HF Hub 에 올립니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <ModelList models={query} selected={model?.id} onSelect={setSelected} />
        {model ? (
          <ModelDetail key={model.id} model={model} />
        ) : (
          <Panel className="min-h-0">
            {query.isPending ? (
              <LoadingNote />
            ) : query.isError ? (
              <ErrorNote error={query.error} onRetry={() => query.refetch()} />
            ) : (
              <EmptyState className="py-10">저장된 모델이 없습니다. Training 의 checkpoint 에서 Save to Models 를 누르세요.</EmptyState>
            )}
          </Panel>
        )}
      </div>
    </Page>
  )
}
