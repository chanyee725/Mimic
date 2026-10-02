import { VideoTile } from "@/components/robot/video-tile"
import type { Device } from "@/dummy/devices"

/** 카메라 타일 2열. 남은 높이를 채운다 */
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
