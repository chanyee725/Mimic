import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Page } from "@/components/layout/page-layout"
import { useDatasets, useMergeDatasets, useMergePreview } from "@/api/datasets"
import { datasetWorlds, isMergeable } from "@/domain/dataset"

import { MergeOutput } from "./components/merge-output"
import { MergeSummary } from "./components/merge-summary"
import { SourceList } from "./components/source-list"
import { defaultRepoId } from "./lib"

export function MergePage() {
  const datasets = useDatasets()
  const candidates = (datasets.data ?? []).filter(isMergeable)
  // Pick order is the merge order; picks that stop being mergeable (deleted, failed) drop out
  const [picked, setPicked] = useState<string[]>([])
  const sources = picked.filter((id) => candidates.some((d) => d.repoId === id))
  const preview = useMergePreview(sources)
  const worlds = [...new Set(candidates.filter((d) => sources.includes(d.repoId)).flatMap(datasetWorlds))]
  const [name, setName] = useState<string | null>(null)
  const repoId = name ?? defaultRepoId(sources[0])

  const merge = useMergeDatasets()
  const navigate = useNavigate()
  const fresh = !!preview.data && !preview.isPlaceholderData
  const canMerge = sources.length >= 2 && fresh && preview.data!.problems.length === 0

  const toggle = (id: string) => {
    merge.reset()
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }
  const start = () =>
    merge.mutate({ sources, repoId: repoId.trim() }, { onSuccess: (d) => navigate(`/datasets?repo=${encodeURIComponent(d.repoId)}`) })

  return (
    <Page
      fit
      title="Merge"
      description="같은 Rig · fps · feature 를 가진 LeRobot 데이터셋을 두 개 이상 골라 하나로 합칩니다. 고른 순서대로 에피소드가 이어집니다."
    >
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SourceList datasets={candidates} query={datasets} picked={sources} onToggle={toggle} onClear={() => setPicked([])} />
        <div className="flex min-h-0 flex-col gap-4">
          <MergeSummary count={sources.length} query={preview} worlds={worlds} />
          <MergeOutput
            repoId={repoId}
            onRepoIdChange={setName}
            count={sources.length}
            canMerge={canMerge}
            merging={merge.isPending}
            error={merge.error}
            onMerge={start}
          />
        </div>
      </div>
    </Page>
  )
}
