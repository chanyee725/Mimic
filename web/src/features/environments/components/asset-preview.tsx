import { lazy, Suspense } from "react"

import { LoadingNote, QueryView } from "@/components/common/query-state"
import { useSimAssetModel } from "@/api/simulation"
import type { SimAsset, SimAssetKind } from "@/domain/simulation"

// three.js stays out of the main bundle until a preview is shown
const ModelViewer = lazy(() => import("@/components/robot/model-viewer").then((m) => ({ default: m.ModelViewer })))

const loading = <LoadingNote>Loading 3D model…</LoadingNote>

/** Static 3D look at a robot or tool (orbit / zoom), converted from its USD by the backend */
export function AssetPreview({ kind, asset }: { kind: SimAssetKind; asset: SimAsset }) {
  const model = useSimAssetModel(kind, asset.id, asset.updatedAt)
  return (
    <section className="flex min-h-80 flex-1 shrink-0 flex-col gap-2">
      <h3 className="text-sm font-semibold">Preview</h3>
      <QueryView query={model} loading={loading}>
        {(data) => (
          <Suspense fallback={loading}>
            <ModelViewer data={data} className="min-h-72 flex-1" />
          </Suspense>
        )}
      </QueryView>
    </section>
  )
}
