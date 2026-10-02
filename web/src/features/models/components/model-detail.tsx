import { Link } from "react-router-dom"
import { LuCloudUpload, LuDownload, LuFlaskConical, LuFootprints, LuHardDrive, LuTarget, LuTrash2, LuTrendingDown } from "react-icons/lu"

import { Button, buttonVariants } from "@/components/ui/button"
import { DetailList } from "@/components/app/detail-list"
import { HfBadge } from "@/components/app/hf-badge"
import { Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { successRate, type Model } from "@/dummy/models"
import { POLICY, POLICY_BASE } from "@/dummy/training"
import { formatPct } from "@/lib/format"

import { ModelEvaluations } from "./model-evaluations"
import { ModelFiles } from "./model-files"

/** 오른쪽 모델 상세. 요약 수치 · 상세 정보 · 평가 기록 · 파일 */
export function ModelDetail({ model: m }: { model: Model }) {
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
    { k: "Base model", v: `${POLICY} (${POLICY_BASE})` },
    { k: "Saved", v: m.savedAt },
    { k: "Local folder", v: m.localPath ?? "Not on this station" },
    { k: "HF Hub", v: m.hubRepo ? `${m.hubRepo} (private)` : "Not uploaded" },
  ]

  return (
    <Panel className="min-h-0 gap-4 overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
            <span className="truncate">{m.name}</span>
            {m.hubRepo && <HfBadge title={m.hubRepo} />}
          </h2>
          <p className="truncate text-[13px] text-muted-foreground">
            {m.dataset}, {m.jobId}, step {m.step.toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm" disabled={!!m.hubRepo}>
            <LuCloudUpload />
            {m.hubRepo ? "On HF Hub" : "Push to HF Hub"}
          </Button>
          <Button variant="outline" size="sm">
            <LuDownload />
            Download
          </Button>
          <Link to={`/evaluate?model=${m.id}`} className={buttonVariants({ size: "sm" })}>
            <LuFlaskConical />
            Evaluate
          </Link>
          <Button variant="ghost" size="icon-sm" aria-label="Delete model" title="Delete model" className="text-bad hover:text-bad">
            <LuTrash2 />
          </Button>
        </div>
      </div>

      <StatStrip
        items={[
          { label: "Step", value: m.step.toLocaleString(), icon: LuFootprints },
          { label: "Train loss", value: m.loss.toFixed(3), icon: LuTrendingDown },
          {
            label: "Success rate",
            value: formatPct(rate),
            sub: m.evals.length ? `${m.evals.reduce((a, e) => a + e.trials, 0)} trials` : "not evaluated",
            icon: LuTarget,
          },
          { label: "Size", value: `${(m.sizeMB / 1024).toFixed(1)} GB`, icon: LuHardDrive },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">Details</h3>
          <DetailList rows={details} bordered />
        </section>

        <div className="grid content-start gap-4">
          <ModelEvaluations model={m} />
          <ModelFiles />
        </div>
      </div>
    </Panel>
  )
}
