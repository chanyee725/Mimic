import { useState } from "react"
import { LuBox } from "react-icons/lu"

import { simEnvThumbnailUrl } from "@/api/simulation"
import type { SimEnv } from "@/domain/simulation"
import { cn } from "@/lib/utils"

/** Thumbnail of an Isaac Sim environment (same-name image next to its script); a box icon when it has none */
export function EnvThumb({ env, className }: { env: SimEnv; className?: string }) {
  const [failed, setFailed] = useState(false)
  const show = !failed && !!env.thumbnail
  return (
    <div
      className={cn(
        "grid aspect-[4/3] shrink-0 place-items-center overflow-hidden rounded-md border bg-stage text-muted-foreground",
        className,
      )}
      role="img"
      aria-label={show ? `${env.name} thumbnail` : "No thumbnail"}
    >
      {show ? (
        <img
          src={`${simEnvThumbnailUrl(env.id)}?t=${encodeURIComponent(env.updatedAt)}`}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <LuBox className="size-4" aria-hidden />
      )}
    </div>
  )
}
