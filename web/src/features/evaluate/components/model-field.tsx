import { LuChevronRight } from "react-icons/lu"

import { useTrainingConfig } from "@/api/training"
import type { Model } from "@/domain/model"

/** Summary of the selected model; click to open the model picker */
export function ModelField({ model, disabled, onOpen }: { model: Model; disabled: boolean; onOpen: () => void }) {
  const gpu = useTrainingConfig().data?.localGpus[0]?.name
  return (
    <div className="grid gap-1.5">
      <span className="text-xs text-muted-foreground">Model</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/60 disabled:pointer-events-none disabled:opacity-60"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-medium">{model.name}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {model.jobId}, step {model.step.toLocaleString()}, loss {model.loss.toFixed(3)}
          </span>
        </span>
        <LuChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <span className="text-xs text-muted-foreground">
        {model.dataset}, inference on {gpu ?? "the local GPU"}
      </span>
    </div>
  )
}
