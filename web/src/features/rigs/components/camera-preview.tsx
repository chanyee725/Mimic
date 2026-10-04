import { useState } from "react"
import { LuVideoOff } from "react-icons/lu"

import { portPreviewUrl } from "@/api/devices"
import { cn } from "@/lib/utils"

/** Live MJPEG preview of a video port; the camera is held only while this is mounted */
export function CameraPreview({ path, className }: { path: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn("relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md border bg-stage", className)}>
      {failed ? (
        <div className="flex flex-col items-center gap-1 px-4 text-center text-xs text-muted-foreground">
          <LuVideoOff className="size-5" />
          <span className="font-medium text-foreground">No signal</span>
          카메라를 열 수 없습니다. 다른 곳에서 사용 중인지 확인하세요.
        </div>
      ) : (
        <img src={portPreviewUrl(path)} alt="" className="size-full object-contain" onError={() => setFailed(true)} />
      )}
    </div>
  )
}
