/** 저장 정렬: 영상 1프레임 = action 2샘플 (166.7 ms 구간) */
export function AlignmentStrip({ actionHz, videoFps }: { actionHz: number; videoFps: number }) {
  const windowMs = 1000 / 6
  const videoTicks = Math.round((videoFps * windowMs) / 1000) + 1
  const actionTicks = Math.round((actionHz * windowMs) / 1000) + 1
  const ratio = actionHz / videoFps

  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
      <span className="font-mono">video {videoFps}</span>
      <div className="flex h-3 justify-between">
        {Array.from({ length: videoTicks }, (_, i) => (
          <span key={i} className="h-3 w-2 rounded-xs bg-series-2" />
        ))}
      </div>
      <span className="font-mono">action {actionHz}</span>
      <div className="flex h-3 justify-between">
        {Array.from({ length: actionTicks }, (_, i) => (
          <span key={i} className="h-3 w-0.75 rounded-[1px] bg-series-1" />
        ))}
      </div>
      <span />
      <span>
        1 video frame = {ratio} action samples ({windowMs.toFixed(1)} ms window)
      </span>
    </div>
  )
}
