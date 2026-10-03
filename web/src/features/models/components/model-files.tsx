import { useModelFiles } from "@/api/models"

import { formatFileSize } from "../lib"
import { ErrorNote } from "./query-state"

/** Files inside the checkpoint folder */
export function ModelFiles({ modelId }: { modelId: string }) {
  const files = useModelFiles(modelId)
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">Files</h3>
      {files.isError ? (
        <ErrorNote error={files.error} onRetry={() => files.refetch()} />
      ) : (
        <ul className="divide-y rounded-md border">
          {files.isPending && <li className="px-3 py-1.5 text-[13px] text-muted-foreground">Loading…</li>}
          {files.data?.length === 0 && <li className="px-3 py-1.5 text-[13px] text-muted-foreground">이 스테이션에 파일이 없습니다.</li>}
          {files.data?.map((f) => (
            <li key={f.path} className="flex justify-between gap-3 px-3 py-1.5 text-[13px]">
              <span className="truncate">{f.path}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatFileSize(f.sizeMB)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
