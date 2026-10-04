import { useEffect, useRef, useState } from "react"
import { LuVideoOff } from "react-icons/lu"

import { portPreviewUrl } from "@/api/devices"
import { cn } from "@/lib/utils"

// The backend ends a preview stream after 30 s; reopen it before that (the new stream takes the camera over)
const REOPEN_MS = 25_000
// A camera can be busy for a moment (a connection test holds it): retry instead of staying on "No signal"
const RETRY_MS = 2_000

/** Live MJPEG preview of a video port; the camera is held only while this is mounted */
export function CameraPreview({ path, compact = false, className }: { path: string; compact?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setRound((r) => r + 1), REOPEN_MS)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (!failed) return
    const t = setTimeout(() => {
      setFailed(false)
      setRound((r) => r + 1)
    }, RETRY_MS)
    return () => clearTimeout(t)
  }, [failed])
  // Removing an <img> does not always end its MJPEG request (Firefox): clear src to hang up
  useEffect(() => {
    const el = img.current
    return () => {
      if (el) el.src = ""
    }
  }, [path])
  return (
    <div className={cn("relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md border bg-stage", className)}>
      {failed ? (
        <div className="flex flex-col items-center gap-1 px-4 text-center text-xs text-muted-foreground">
          <LuVideoOff className="size-5" />
          <span className="font-medium text-foreground">No signal</span>
          {!compact && "카메라를 여는 중입니다. 계속 안 나오면 다른 곳에서 사용 중인지 확인하세요."}
        </div>
      ) : (
        <img
          ref={img}
          src={`${portPreviewUrl(path)}&r=${round}`}
          alt=""
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
