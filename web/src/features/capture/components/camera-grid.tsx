import { VideoTile } from "@/components/robot/video-tile"
import type { Device } from "@/domain/device"

/** Two-column camera tiles that fill the remaining height */
export function CameraGrid({ cameras, recording, timecode }: { cameras: Device[]; recording: boolean; timecode?: string }) {
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
          measuredFps={c.streams[0].measuredHz}
          targetFps={c.streams[0].targetHz}
        />
      ))}
    </div>
  )
}
