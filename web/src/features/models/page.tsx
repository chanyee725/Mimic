import { useState } from "react"

import { Page } from "@/components/app/page"
import { MODELS } from "@/dummy/models"

import { ModelDetail } from "./components/model-detail"
import { ModelList } from "./components/model-list"
import { SORTED } from "./lib"

export function ModelsPage() {
  const [selected, setSelected] = useState(SORTED[0].id)
  const model = MODELS.find((m) => m.id === selected) ?? SORTED[0]

  return (
    <Page fit title="Models" description="학습에서 저장한 checkpoint 를 모델로 모아 보고, 평가하거나 HF Hub 에 올립니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <ModelList selected={model.id} onSelect={setSelected} />
        <ModelDetail model={model} />
      </div>
    </Page>
  )
}
