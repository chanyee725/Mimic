import { VideoTile } from "@/components/robot/video-tile"
import type { Device } from "@/domain/device"

/** Two-column camera tiles that fill the remaining height. `loading` shows while the rig's cameras are not known yet */
export function CameraGrid({
  cameras,
  loading,
  recording,
  timecode,
}: {
  cameras: Device[]
  loading?: React.ReactNode
  recording: boolean
  timecode?: string
}) {
  return (
    <div className="grid min-h-48 flex-1 gap-3 md:grid-cols-2">
      {cameras.map((c) => (
        <VideoTile
          className="aspect-auto h-full min-h-48"
          recording={recording}
          timecode={timecode}
          key={c.id}
          label={c.name.replace(/ camera$/, "")}
          resolution={c.stats.find((s) => s.label === "Resolution")?.value ?? ""}
          measuredFps={c.streams[0]?.measuredHz ?? null}
          targetFps={c.streams[0]?.targetHz ?? null}
        />
      ))}
      {cameras.length === 0 && (
        <div className="grid place-items-center rounded-lg border bg-stage md:col-span-2">
          {loading ?? <span className="text-xs text-muted-foreground">이 Rig 에는 카메라가 없습니다.</span>}
        </div>
      )}
    </div>
  )
}
