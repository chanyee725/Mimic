import { LuVideoOff } from "react-icons/lu"

import { cn } from "@/lib/utils"

type Props = {
  label: string
  resolution: string
  measuredFps: number | null
  targetFps: number | null
  /** mm:ss:ff (ff = frame), shown top right (recording or playback) */
  timecode?: string
  /** Video source filling the tile (e.g. a CameraPreview); without it the tile shows "No signal" */
  children?: React.ReactNode
  /** Hint under "No signal" while no video track is attached */
  hint?: string
  className?: string
}

/** Video tile: label, timecode and resolution / fps badges over a source, or an honest "No signal" state without one. */
export function VideoTile({
  label,
  resolution,
  measuredFps,
  targetFps,
  timecode,
  children,
  hint = "장치가 연결되면 영상이 표시됩니다.",
  className,
}: Props) {
  const low = measuredFps !== null && targetFps !== null && measuredFps < targetFps * 0.98

  return (
    <figure
      className={cn("relative m-0 flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-stage", className)}
    >
      {children ?? (
        <div className="flex flex-col items-center gap-1 px-4 text-center text-xs text-muted-foreground">
          <LuVideoOff className="mb-0.5 size-6" />
          <span className="font-medium text-foreground">No signal</span>
          {hint}
        </div>
      )}
      <figcaption className="absolute top-2.5 left-2.5 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">{label}</figcaption>
      {timecode && (
        <span className="absolute top-2.5 right-2.5 rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background tabular-nums">
          {timecode}
        </span>
      )}
      <span
        className={cn(
          "absolute right-2.5 bottom-2.5 rounded-md border bg-background px-2 py-0.5 text-[11px] tabular-nums",
          low ? "text-warn" : "text-muted-foreground",
        )}
      >
        {resolution && `${resolution}, `}
        {measuredFps?.toFixed(1) ?? "—"} fps
      </span>
    </figure>
  )
}
