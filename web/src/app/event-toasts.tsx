import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast, Toaster } from "sonner"

import { onServerEvent, type ServerEvent } from "@/api/events"
import type { Dataset } from "@/domain/dataset"
import type { Recording } from "@/domain/recording"
import type { TrainJob } from "@/domain/training"

type Navigate = (to: string) => void

/** What was last seen of each job / dataset, so a toast fires on a change and not on every update */
type JobSeen = { status: TrainJob["status"]; step: number; checkpoints: number }
const jobs = new Map<string, JobSeen>()
const datasets = new Map<string, Dataset["status"]>()

function onTraining(job: TrainJob, go: Navigate) {
  const prev = jobs.get(job.id)
  jobs.set(job.id, { status: job.status, step: job.step, checkpoints: job.checkpoints.length })
  const open = { label: "Open", onClick: () => go(`/training/${job.id}`) }
  const name = `${job.id} · ${job.dataset}`

  if (prev?.status !== job.status) {
    if (job.status === "queued") toast.info("Training queued", { description: `${name}: GPU 가 비면 시작합니다.`, action: open })
    // A running job seen for the first time mid-run (page reload) is not a start
    else if (job.status === "running" && (prev || job.step === 0))
      toast.info("Training started", { description: `${name}: lerobot-train 을 실행했습니다. 모델을 불러오는 중입니다.`, action: open })
    else if (job.status === "done")
      toast.success("Training finished", { description: `${name}: ${job.total.toLocaleString()} step 완료`, action: open })
    else if (job.status === "failed")
      toast.error("Training failed", {
        description: `${name}: ${job.error ?? "lerobot-train 이 종료되었습니다."}`,
        action: open,
        duration: 15_000,
      })
    else if (job.status === "stopped") toast("Training stopped", { description: name, action: open })
    return
  }
  if (!prev || job.status !== "running") return
  if (prev.step === 0 && job.step > 0)
    toast.success("Training is running", { description: `${name}: 첫 step 을 마쳤습니다. 학습이 정상적으로 진행 중입니다.`, action: open })
  if (job.checkpoints.length > prev.checkpoints) {
    const step = Math.max(...job.checkpoints.map((c) => c.step))
    toast.success("Checkpoint saved", { description: `${name}: step ${step.toLocaleString()}`, action: open })
  }
}

function onDataset(ds: Dataset, go: Navigate) {
  const prev = datasets.get(ds.repoId)
  datasets.set(ds.repoId, ds.status)
  if (prev === ds.status) return
  const open = { label: "Open", onClick: () => go(`/datasets?repo=${encodeURIComponent(ds.repoId)}`) }
  if (ds.status === "converting") toast.info("Dataset build started", { description: `${ds.repoId}: 변환을 시작했습니다.`, action: open })
  // Only a build this tab saw start: a ready dataset re-published later (Hub push) is not news
  else if (ds.status === "ready" && prev === "converting")
    toast.success("Dataset ready", { description: `${ds.repoId}: 데이터 변환이 끝났습니다.`, action: open })
  else if (ds.status === "failed")
    toast.error("Dataset build failed", {
      description: `${ds.repoId}: ${ds.error ?? "변환에 실패했습니다."}`,
      action: open,
      duration: 15_000,
    })
}

function onRecording(r: Recording, go: Navigate) {
  const file = r.file.split("/").pop()
  const open = { label: "Review", onClick: () => go("/review") }
  if (r.source === "external") toast.success("Recording imported", { description: file, action: open })
  else toast.success("Episode saved", { description: `${file}${r.outcome ? ` · ${r.outcome}` : ""}`, action: open })
}

function handle(e: ServerEvent, go: Navigate) {
  if (e.type === "training.updated") onTraining(e.data as TrainJob, go)
  else if (e.type === "dataset.updated") onDataset(e.data as Dataset, go)
  else if (e.type === "recording.created") onRecording(e.data as Recording, go)
}

/** Top-right toasts for background work the station reports over the events socket (training, dataset builds, saved episodes) */
export function EventToasts() {
  const navigate = useNavigate()
  useEffect(() => onServerEvent((e) => handle(e, navigate)), [navigate])
  return (
    <Toaster
      position="top-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-background !font-sans !text-foreground !shadow-none",
          description: "!text-muted-foreground",
          actionButton: "!bg-foreground !text-background",
        },
      }}
    />
  )
}
