/**
 * 3D 뷰어 자리.
 * 구현 시 react-three-fiber + urdf-loader 로 SO-101 URDF 를 그리고
 * leader(목표) / follower(실제) / 리타게팅 결과를 겹쳐 보여준다.
 */
export function Viewer3D() {
  return (
    <section aria-label="3D viewer" className="relative aspect-16/10 overflow-hidden rounded-lg border bg-stage">
      <svg viewBox="0 0 400 250" className="absolute inset-0 size-full" aria-hidden>
        <g className="stroke-stage-line" strokeWidth={1}>
          <line x1="40" y1="210" x2="360" y2="210" />
          <line x1="70" y1="190" x2="330" y2="190" />
          <line x1="100" y1="172" x2="300" y2="172" />
          <line x1="200" y1="160" x2="200" y2="220" />
          <line x1="130" y1="160" x2="90" y2="220" />
          <line x1="270" y1="160" x2="310" y2="220" />
        </g>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="185,195 185,160 150,105 215,80 240,98" strokeWidth={7} className="stroke-series-1 opacity-35" />
          <polyline points="190,195 190,158 158,102 222,82 246,104" strokeWidth={6} className="stroke-foreground" />
          <path d="M246 104 l10 12 M246 104 l14 4" strokeWidth={4} className="stroke-foreground" />
        </g>
        <rect x="170" y="192" width="40" height="10" rx="2" className="fill-muted-foreground" />
        <rect x="266" y="178" width="14" height="14" rx="2" className="fill-series-4" />
        <rect x="284" y="178" width="14" height="14" rx="2" className="fill-series-1" />
      </svg>
      <span className="absolute top-2.5 left-2.5 rounded-md border bg-background px-2 py-0.5 text-xs font-medium">
        3D · SO-101 URDF
      </span>
      <div className="absolute right-2.5 bottom-2.5 flex gap-2.5 rounded-md border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.75 w-2.5 bg-foreground" />
          follower
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.75 w-2.5 bg-series-1" />
          leader
        </span>
      </div>
    </section>
  )
}
