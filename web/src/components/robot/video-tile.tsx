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
  /** Video width / height: the tile keeps this shape inside its grid cell, so the video has no bands */
  aspect?: number
  className?: string
}

/**
 * Row of video tiles (two columns when there are several) as tall as the tiles' aspect needs at the row's width.
 * In a flex column it shrinks when space runs out, and the tiles then fit their cells (VideoTile `aspect`).
 */
export function VideoGrid({ count, aspect, children }: { count: number; aspect: number; children: React.ReactNode }) {
  const cols = count > 1 ? 2 : 1
  return (
    <div className="@container min-h-48 shrink">
      <div
        className={cn("grid max-h-full min-h-48 gap-3", cols === 2 && "grid-cols-2")}
        style={{ height: `calc((100cqw - ${(cols - 1) * 0.75}rem) / ${cols} / ${aspect})` }}
      >
        {children}
      </div>
    </div>
  )
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
  aspect,
  className,
}: Props) {
  const low = measuredFps !== null && targetFps !== null && measuredFps < targetFps * 0.98

  const tile = (
    <figure
      className={cn("relative m-0 flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-stage", className)}
      // Largest box of the video's shape that fits the cell (the cell is a size container)
      style={aspect ? { aspectRatio: aspect, width: `min(100cqw, 100cqh * ${aspect})` } : undefined}
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
  if (!aspect) return tile
  return <div className="flex min-h-0 min-w-0 items-center justify-center [container-type:size]">{tile}</div>
}
