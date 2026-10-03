import { Panel } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/common/empty-state"
import { QueryNote } from "@/components/common/query-state"
import { StatusDot } from "@/components/common/status-dot"
import type { MergePreview } from "@/domain/dataset"

type PreviewQuery = { data?: MergePreview; isPending: boolean; error: Error | null; refetch: () => unknown }

/** Totals, per-source rows, features and problems of the merge preview */
export function MergeSummary({ count, query }: { count: number; query: PreviewQuery }) {
  const preview = query.data
  return (
    <Panel title="Summary" className="min-h-0 flex-1 overflow-y-auto">
      {count === 0 ? (
        <EmptyState>왼쪽에서 합칠 데이터셋을 두 개 이상 고르세요.</EmptyState>
      ) : !preview ? (
        <QueryNote query={query} />
      ) : (
        <>
          <dl className="grid grid-cols-4 gap-x-6 gap-y-3">
            {[
              { k: "Episodes", v: preview.episodes.toLocaleString() },
              { k: "Frames", v: preview.frames.toLocaleString() },
              { k: "fps", v: preview.fps ?? "—" },
              { k: "Size", v: `${preview.sizeGB} GB` },
            ].map((m) => (
              <div key={m.k} className="grid content-start gap-0.5">
                <dt className="text-xs text-muted-foreground">{m.k}</dt>
                <dd className="text-[13px] whitespace-nowrap tabular-nums">{m.v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-1.5">
            {preview.problems.map((p) => (
              <StatusDot key={p} tone="warn" className="text-[13px]">
                {p}
              </StatusDot>
            ))}
            {preview.problems.length === 0 &&
              (count < 2 ? (
                <p className="text-[13px] text-muted-foreground">데이터셋을 하나 더 고르면 합칠 수 있습니다.</p>
              ) : (
                <StatusDot tone="ok" className="text-[13px]">
                  Ready to merge
                </StatusDot>
              ))}
          </div>

          <section className="grid gap-1.5">
            <h3 className="text-xs text-muted-foreground">Sources, in merge order</h3>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-normal">Dataset</th>
                  <th className="py-1.5 pr-3 font-normal">Task</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Episodes</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Frames</th>
                  <th className="py-1.5 text-right font-normal">fps</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.sources.map((s) => (
                  <tr key={s.repoId}>
                    <td className="max-w-48 truncate py-1.5 pr-3">{s.repoId}</td>
                    <td className="max-w-36 truncate py-1.5 pr-3 text-muted-foreground">{s.taskId}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.episodes.toLocaleString()}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{s.frames.toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.fps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {preview.features.length > 0 && (
            <section className="grid gap-1.5">
              <h3 className="text-xs text-muted-foreground">Features</h3>
              <ul className="divide-y rounded-md border">
                {preview.features.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
                    <span className="truncate">{f.key}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {f.dtype} {f.shape}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {query.error && <QueryNote query={query} />}
        </>
      )}
    </Panel>
  )
}
