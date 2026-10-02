import { LuVideo } from "react-icons/lu"

import { cn } from "@/lib/utils"

type Props = {
  label: string
  resolution: string
  measuredFps: number | null
  targetFps: number | null
  /** 녹화 중이면 카메라 뷰파인더처럼 빨간 테두리와 REC 타임코드를 띄운다 */
  recording?: boolean
  /** mm:ss:ff (ff = 프레임) */
  timecode?: string
  className?: string
}

/** WebRTC 영상 트랙이 붙을 자리. 지금은 플레이스홀더만 그린다. */
export function VideoTile({ label, resolution, measuredFps, targetFps, recording = false, timecode, className }: Props) {
  const low = measuredFps !== null && targetFps !== null && measuredFps < targetFps * 0.98

  return (
    <figure
      className={cn(
        "relative m-0 flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-stage transition-[box-shadow,border-color]",
        recording && "border-bad shadow-[0_0_0_1px_var(--bad)]",
        className,
      )}
    >
      {/* <video autoPlay muted playsInline ref={...} /> */}
      <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
        <LuVideo className="size-6" />
        WebRTC stream
      </div>
      <figcaption className="absolute top-2.5 left-2.5 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
        {label}
      </figcaption>
      {recording && (
        <span className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-md bg-bad px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
          <span className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
          REC {timecode}
        </span>
      )}
      <span
        className={cn(
          "absolute right-2.5 bottom-2.5 rounded-md border bg-background px-2 py-0.5 text-[11px] tabular-nums",
          low ? "text-warn" : "text-muted-foreground",
        )}
      >
        {resolution}, {measuredFps?.toFixed(1) ?? "—"} fps
      </span>
    </figure>
  )
}
