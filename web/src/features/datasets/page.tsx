import { useSearchParams } from "react-router-dom"

import { Page, Panel } from "@/components/layout/page-layout"
import { useDatasets } from "@/api/datasets"

import { DatasetDetail } from "./components/dataset-detail"
import { DatasetList } from "./components/dataset-list"
import { QueryNote } from "@/components/common/query-state"

export function DatasetsPage() {
  const datasets = useDatasets()
  // ?repo= keeps the selection linkable (Convert opens the new dataset this way)
  const [params, setParams] = useSearchParams()
  const list = datasets.data ?? []
  const selected = params.get("repo") ?? list[0]?.repoId
  const select = (repoId: string | null) => setParams(repoId ? { repo: repoId } : {}, { replace: true })

  return (
    <Page fit title="Datasets" description="변환한 LeRobot 데이터셋과 원본 MCAP 묶음을 확인하고 HF Hub 에 올리거나 학습에 사용합니다.">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
        <DatasetList datasets={list} query={datasets} selected={selected} onSelect={select} />
        {selected ? (
          <DatasetDetail
            key={selected}
            repoId={selected}
            fallback={list.find((d) => d.repoId === selected)}
            onDeleted={() => select(null)}
          />
        ) : (
          <Panel className="min-h-0">
            <QueryNote query={datasets} />
            {datasets.data?.length === 0 && <p className="text-[13px] text-muted-foreground">아직 데이터셋이 없습니다.</p>}
          </Panel>
        )}
      </div>
    </Page>
  )
}
