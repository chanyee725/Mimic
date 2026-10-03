import { useState } from "react"
import { LuArrowRightLeft, LuClock, LuCloudUpload, LuCpu, LuFilm, LuHardDrive, LuListVideo, LuRotateCcw, LuTrash2 } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { LinkButton } from "@/components/common/link-button"
import { EmptyState } from "@/components/common/empty-state"
import { HfBadge } from "@/components/common/hf-badge"
import { Panel } from "@/components/layout/page-layout"
import { ProgressBar } from "@/components/common/progress-bar"
import { StatStrip } from "@/components/common/stat-strip"
import { StatusDot } from "@/components/common/status-dot"
import { useDataset, useDatasetEpisodes, useDeleteDataset, usePushDataset } from "@/api/datasets"
import { useRig } from "@/api/rigs"
import { useTask } from "@/api/tasks"
import type { Dataset } from "@/domain/dataset"
import { formatDateTime, formatLength } from "@/lib/format"

import { STATUS } from "../lib"
import { DatasetThumb } from "./dataset-thumb"
import { DeleteDatasetDialog } from "./delete-dataset-dialog"
import { ErrorNote, QueryNote } from "@/components/common/query-state"

/**
 * Detail of one dataset. `fallback` (the list row) shows until the detail query answers.
 * The page keys it by repoId so mutation state resets on selection.
 */
export function DatasetDetail({ repoId, fallback, onDeleted }: { repoId: string; fallback?: Dataset; onDeleted: () => void }) {
  const detail = useDataset(repoId)
  const dataset = detail.data ?? fallback
  if (!dataset)
    return (
      <Panel className="min-h-0">
        <QueryNote query={detail} />
      </Panel>
    )
  return <DatasetView dataset={dataset} onDeleted={onDeleted} />
}

function DatasetView({ dataset, onDeleted }: { dataset: Dataset; onDeleted: () => void }) {
  const task = useTask(dataset.taskId).data
  const rig = useRig(dataset.rigId).data
  const episodes = useDatasetEpisodes(dataset.repoId)
  const rows = episodes.data?.pages.flatMap((p) => p.items) ?? []
  // Totals need every episode; until the last page is in they stay unknown
  const complete = !!episodes.data && !episodes.hasNextPage
  const frames = rows.reduce((a, e) => a + e.frames, 0)
  const lengthS = rows.reduce((a, e) => a + e.lengthS, 0)
  const status = STATUS[dataset.status]

  const push = usePushDataset()
  const del = useDeleteDataset()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <Panel className="min-h-0 gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-64 flex-1 basis-0 items-center gap-4">
          <DatasetThumb taskId={dataset.taskId} className="w-32" />
          <div className="grid min-w-0 gap-1">
            <h2 className="truncate text-lg font-semibold">{dataset.repoId}</h2>
            <div className="flex items-center gap-2">
              <StatusDot tone={status.tone} className="shrink-0 text-[13px]">
                {status.label}
              </StatusDot>
              {dataset.hub.pushed && <HfBadge title={dataset.hub.private ? "On HF Hub (private)" : "On HF Hub"} />}
            </div>
            <p className="truncate text-[13px] text-muted-foreground">{task?.instruction ?? dataset.taskId}</p>
            <p className="truncate text-xs text-muted-foreground">
              {rig?.name ?? dataset.rigId}, {dataset.format}
              {dataset.kind === "lerobot" && `, ${dataset.fps} fps`}, created {formatDateTime(dataset.createdAt)}
            </p>
          </div>
        </div>
        <div className="grid shrink-0 justify-items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={push.isPending || dataset.status !== "ready" || dataset.hub.pushed}
              onClick={() => push.mutate({ repoId: dataset.repoId, private: dataset.hub.private })}
            >
              <LuCloudUpload />
              {dataset.hub.pushed
                ? dataset.hub.private
                  ? "On HF Hub (private)"
                  : "On HF Hub"
                : push.isPending
                  ? "Pushing…"
                  : "Push to HF Hub"}
            </Button>
            {dataset.kind === "lerobot" ? (
              <LinkButton to="/training" size="sm" disabled={dataset.status !== "ready"}>
                <LuCpu />
                Train with this
              </LinkButton>
            ) : (
              <LinkButton to="/convert" size="sm">
                <LuArrowRightLeft />
                Convert to LeRobot
              </LinkButton>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete dataset"
              title="Delete dataset"
              className="text-bad hover:text-bad"
              onClick={() => {
                del.reset()
                setConfirmDelete(true)
              }}
            >
              <LuTrash2 />
            </Button>
          </div>
          <ErrorNote error={push.error} className="max-w-96" />
        </div>
      </div>

      {dataset.status === "converting" && (
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>Encoding videos and writing parquet files</span>
            <span>{dataset.progress ?? 0}%</span>
          </div>
          <ProgressBar value={dataset.progress ?? 0} label="Conversion progress" />
        </div>
      )}

      {dataset.status === "failed" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-bad-muted px-3 py-2.5 text-[13px] text-bad">
          <span>{dataset.error ?? "변환이 중단됐습니다. 원인을 확인한 뒤 다시 시도하세요."}</span>
          <LinkButton to="/convert" variant="outline" size="sm" className="bg-background">
            <LuRotateCcw />
            Convert again
          </LinkButton>
        </div>
      )}

      {dataset.episodeCount > 0 && (
        <StatStrip
          items={[
            { label: "Episodes", value: dataset.episodeCount.toLocaleString(), icon: LuListVideo },
            {
              label: dataset.kind === "mcap" ? "Video frames" : "Frames",
              value: complete ? frames.toLocaleString() : "—",
              icon: LuFilm,
            },
            { label: "Length", value: complete ? formatLength(lengthS) : "—", icon: LuClock },
            { label: "Size", value: `${dataset.sizeGB} GB`, icon: LuHardDrive },
          ]}
        />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col gap-2">
          <h3 className="text-sm font-semibold">{dataset.kind === "mcap" ? "Topics" : "Features"}</h3>
          <div className="min-h-0 overflow-auto rounded-md border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-normal">{dataset.kind === "mcap" ? "Topic" : "Key"}</th>
                  <th className="px-3 py-2 font-normal">{dataset.kind === "mcap" ? "Schema" : "Type"}</th>
                  <th className="px-3 py-2 font-normal">{dataset.kind === "mcap" ? "Rate" : "Shape"}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dataset.features.map((f) => (
                  <tr key={f.key}>
                    <td className="max-w-56 px-3 py-1.5">
                      <span className="block truncate">{f.key}</span>
                      {f.note && <span className="block truncate text-[11px] text-muted-foreground">{f.note}</span>}
                    </td>
                    <td className="max-w-36 truncate px-3 py-1.5 text-muted-foreground" title={f.dtype}>
                      {f.dtype}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground tabular-nums">{f.shape}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-2">
          <h3 className="text-sm font-semibold">Episodes</h3>
          {episodes.isPending || episodes.error ? (
            <QueryNote query={episodes} />
          ) : rows.length === 0 ? (
            <EmptyState>변환된 에피소드가 없습니다.</EmptyState>
          ) : (
            <ul className="min-h-0 divide-y overflow-y-auto rounded-md border">
              {rows.map((e) => (
                <li key={e.index} className="grid grid-cols-[3rem_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-1.5 text-[13px]">
                  <span className="text-muted-foreground tabular-nums">#{e.index}</span>
                  <span className="truncate">{e.source.split("/").pop()}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{e.lengthS.toFixed(1)} s</span>
                  <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">{e.frames} frames</span>
                </li>
              ))}
              {episodes.hasNextPage && (
                <li className="px-3 py-1.5 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    disabled={episodes.isFetchingNextPage}
                    onClick={() => void episodes.fetchNextPage()}
                  >
                    {episodes.isFetchingNextPage ? "Loading…" : `Load more (${rows.length} of ${dataset.episodeCount})`}
                  </Button>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      <DeleteDatasetDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        repoId={dataset.repoId}
        converting={dataset.status === "converting"}
        pending={del.isPending}
        error={del.error}
        onConfirm={() =>
          del.mutate(dataset.repoId, {
            onSuccess: () => {
              setConfirmDelete(false)
              onDeleted()
            },
          })
        }
      />
    </Panel>
  )
}
