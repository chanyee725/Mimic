import { useState } from "react"
import { LuImageOff } from "react-icons/lu"

import { datasetThumbnailUrl } from "@/api/datasets"
import type { Dataset } from "@/domain/dataset"
import { hasVideo } from "@/domain/dataset"
import { cn } from "@/lib/utils"

/** First camera frame of the dataset's first episode; an empty slot when it has no video (or isn't ready) */
export function DatasetThumb({ dataset, className }: { dataset: Dataset; className?: string }) {
  const [failed, setFailed] = useState(false)
  // The thumbnail is cut from the dataset's video, so only ask for it once one exists (no 404s)
  const show = !failed && dataset.status === "ready" && hasVideo(dataset)
  return (
    <div
      className={cn(
        "grid aspect-[4/3] shrink-0 place-items-center overflow-hidden rounded-md border bg-stage text-muted-foreground",
        className,
      )}
      role="img"
      aria-label={show ? `${dataset.repoId} thumbnail` : "No thumbnail"}
    >
      {show ? (
        <img
          src={`${datasetThumbnailUrl(dataset.repoId)}?t=${encodeURIComponent(dataset.createdAt)}`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <LuImageOff className="size-4" aria-hidden />
      )}
    </div>
  )
}
