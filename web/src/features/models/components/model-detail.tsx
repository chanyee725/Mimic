import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  LuCloudUpload,
  LuDownload,
  LuFlaskConical,
  LuFootprints,
  LuHardDrive,
  LuPencil,
  LuTarget,
  LuTrash2,
  LuTrendingDown,
} from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Panel } from "@/components/layout/page-layout"
import { DetailList } from "@/components/common/detail-list"
import { HfBadge } from "@/components/common/hf-badge"
import { LinkButton } from "@/components/common/link-button"
import { StatStrip } from "@/components/common/stat-strip"
import { modelDownloadUrl, useDeleteModel, usePushModel, useRenameModel } from "@/api/models"
import { useTrainingConfig } from "@/api/training"
import { successRate, type Model } from "@/domain/model"
import { formatDateTime, formatPct, formatSize, plural } from "@/lib/format"

import { downloadFile } from "../lib"
import { ModelEvaluations } from "./model-evaluations"
import { ModelFiles } from "./model-files"
import { ErrorNote } from "@/components/common/query-state"

/** Right-hand model detail: stats, details, evaluations and files */
export function ModelDetail({ model: m }: { model: Model }) {
  const config = useTrainingConfig().data
  const push = usePushModel()
  const download = useMutation({ mutationFn: () => downloadFile(modelDownloadUrl(m.id)) })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const del = useDeleteModel()
  const rate = successRate(m)
  const details = [
    { k: "Task", v: m.taskId },
    { k: "Dataset", v: m.dataset },
    {
      k: "Trained by",
      v: (
        <Link to={`/training/${m.jobId}`} className="underline underline-offset-4 hover:text-foreground">
          {m.jobId}, step {m.step.toLocaleString()}
        </Link>
      ),
    },
    { k: "Base model", v: config ? `${config.policy} (${config.policyBase})` : "—" },
    { k: "Saved", v: formatDateTime(m.savedAt) },
    { k: "Local folder", v: m.localPath ?? "Not on this station" },
    { k: "HF Hub", v: m.hubRepo ? `${m.hubRepo} (private)` : "Not uploaded" },
  ]

  return (
    <Panel className="min-h-0 gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <ModelName model={m} />
          <p className="truncate text-[13px] text-muted-foreground">
            {m.dataset}, {m.jobId}, step {m.step.toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={!!m.hubRepo || push.isPending} onClick={() => push.mutate({ id: m.id })}>
            <LuCloudUpload />
            {m.hubRepo ? "On HF Hub" : push.isPending ? "Pushing…" : "Push to HF Hub"}
          </Button>
          <Button variant="outline" size="sm" disabled={download.isPending} onClick={() => download.mutate()}>
            <LuDownload />
            Download
          </Button>
          <LinkButton to={`/evaluate?model=${m.id}`} size="sm">
            <LuFlaskConical />
            Evaluate
          </LinkButton>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete model"
            title="Delete model"
            className="text-bad hover:text-bad"
            onClick={() => setDeleteOpen(true)}
          >
            <LuTrash2 />
          </Button>
        </div>
      </div>
      <ErrorNote error={push.error ?? download.error} />

      <StatStrip
        items={[
          { label: "Step", value: m.step.toLocaleString(), icon: LuFootprints },
          { label: "Train loss", value: m.loss.toFixed(3), icon: LuTrendingDown },
          {
            label: "Success rate",
            value: formatPct(rate),
            sub: m.evals.length
              ? plural(
                  m.evals.reduce((a, e) => a + e.trials, 0),
                  "trial",
                )
              : "not evaluated",
            icon: LuTarget,
          },
          { label: "Size", value: formatSize(m.sizeMB), icon: LuHardDrive },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">Details</h3>
          <DetailList rows={details} bordered />
        </section>

        <div className="grid content-start gap-4">
          <ModelEvaluations model={m} />
          {/* Unmounted while deleting so the list refetch does not ask for the files of a deleted model */}
          {del.isIdle || del.isError ? <ModelFiles modelId={m.id} /> : null}
        </div>
      </div>
      <DeleteModelDialog model={m} del={del} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </Panel>
  )
}

/** Model name with an inline rename (Enter saves, Esc cancels) */
function ModelName({ model: m }: { model: Model }) {
  const rename = useRenameModel()
  const [draft, setDraft] = useState<string | null>(null)
  const save = () => {
    const name = draft?.trim()
    if (!name || name === m.name) return setDraft(null)
    rename.mutate({ id: m.id, name }, { onSuccess: () => setDraft(null) })
  }

  if (draft !== null)
    return (
      <div className="grid gap-1">
        <Input
          autoFocus
          aria-label="Model name"
          className="h-8 w-80 text-[15px] font-semibold"
          value={draft}
          disabled={rename.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") {
              rename.reset()
              setDraft(null)
            }
          }}
        />
        <ErrorNote error={rename.error} />
      </div>
    )

  return (
    <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
      <span className="truncate">{m.name}</span>
      {m.hubRepo && <HfBadge title={m.hubRepo} />}
      <Button variant="ghost" size="icon-xs" aria-label="Rename model" title="Rename" onClick={() => setDraft(m.name)}>
        <LuPencil />
      </Button>
    </h2>
  )
}

/** Confirms deleting the model and its local folder */
function DeleteModelDialog({
  model: m,
  del,
  open,
  onOpenChange,
}: {
  model: Model
  del: ReturnType<typeof useDeleteModel>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) del.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {m.name}?</DialogTitle>
          <DialogDescription>
            이 스테이션의 모델 폴더{m.localPath ? ` (${m.localPath})` : ""} 를 지웁니다.
            {m.hubRepo ? " HF Hub 저장소는 그대로 남습니다." : ""}
          </DialogDescription>
        </DialogHeader>
        <ErrorNote error={del.error} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={del.isPending} onClick={() => del.mutate(m.id, { onSuccess: () => onOpenChange(false) })}>
            <LuTrash2 />
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
