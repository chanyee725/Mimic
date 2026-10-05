import { CameraPreview } from "@/components/robot/camera-preview"
import { VideoGrid, VideoTile } from "@/components/robot/video-tile"
import type { Device } from "@/domain/device"
import { aspectOf } from "@/lib/format"

/**
 * Two-column camera tiles shaped like the video, each with the camera's live preview when its port is found.
 * `empty` replaces the no-camera note (loading, errors, no task)
 */
export function CameraGrid({
  cameras,
  livePorts,
  empty,
  timecode,
}: {
  cameras: Device[]
  /** Scanned video ports (path and node); a camera on another port shows "No signal" */
  livePorts: Set<string>
  empty?: React.ReactNode
  timecode?: string
}) {
  const resolution = (c: Device) => c.stats.find((s) => s.label === "Resolution")?.value ?? ""
  if (cameras.length === 0)
    return (
      <div className="grid min-h-48 flex-1 place-items-center rounded-lg border bg-stage px-4 text-center">
        {empty ?? <span className="text-xs text-muted-foreground">이 Rig 에는 카메라가 없습니다.</span>}
      </div>
    )
  return (
    <VideoGrid count={cameras.length} aspect={aspectOf(resolution(cameras[0]))}>
      {cameras.map((c) => (
        <VideoTile
          className="aspect-auto"
          aspect={aspectOf(resolution(c))}
          timecode={timecode}
          key={c.id}
          label={c.name.replace(/ camera$/, "")}
          resolution={resolution(c)}
          measuredFps={c.streams[0]?.measuredHz ?? null}
          targetFps={c.streams[0]?.targetHz ?? null}
        >
          {livePorts.has(c.port) ? (
            <CameraPreview path={c.port} className="absolute inset-0 aspect-auto size-full rounded-none border-0" />
          ) : undefined}
        </VideoTile>
      ))}
    </VideoGrid>
  )
}
