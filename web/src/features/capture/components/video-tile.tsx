import { LuVideo } from "react-icons/lu"

import { cn } from "@/lib/utils"

type Props = {
  label: string
  resolution: string
  measuredFps: number | null
  targetFps: number | null
}

/** WebRTC 영상 트랙이 붙을 자리. 지금은 플레이스홀더만 그린다. */
export function VideoTile({ label, resolution, measuredFps, targetFps }: Props) {
  const low = measuredFps !== null && targetFps !== null && measuredFps < targetFps * 0.98

  return (
    <figure className="relative m-0 flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-stage">
      {/* <video autoPlay muted playsInline ref={...} /> */}
      <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
        <LuVideo className="size-6" />
        WebRTC stream
      </div>
      <figcaption className="absolute top-2.5 left-2.5 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
        {label}
      </figcaption>
      <span
        className={cn(
          "absolute right-2.5 bottom-2.5 rounded-md border bg-background px-2 py-0.5 font-mono text-[11px]",
          low ? "text-warn" : "text-muted-foreground",
        )}
      >
        {resolution} · {measuredFps?.toFixed(1) ?? "—"} fps
      </span>
    </figure>
  )
}
