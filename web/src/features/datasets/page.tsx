import { useState } from "react"

import { Page } from "@/components/layout/page-layout"
import { listDatasets } from "@/api/datasets"

import { DatasetDetail } from "./components/dataset-detail"
import { DatasetList } from "./components/dataset-list"
import { sortedDatasets } from "./lib"

export function DatasetsPage() {
  const sorted = sortedDatasets()
  const [selected, setSelected] = useState(sorted[0].repoId)
  const dataset = listDatasets().find((d) => d.repoId === selected) ?? sorted[0]

  return (
    <Page fit title="Datasets" description="변환한 LeRobot 데이터셋과 원본 MCAP 묶음을 확인하고 HF Hub 에 올리거나 학습에 사용합니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <DatasetList selected={dataset.repoId} onSelect={setSelected} />
        <DatasetDetail dataset={dataset} />
      </div>
    </Page>
  )
}
