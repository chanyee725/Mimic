import { cn } from "@/lib/utils"

// Dummy thumbnail: the real one is the first top-camera frame (JPEG) of the first episode.
// Here each task's workbench scene is drawn with simple shapes.

type Shape =
  | { t: "box"; x: number; y: number; w: number; h: number; c: string }
  | { t: "dish"; x: number; y: number; rx: number; ry: number; c: string }

const RED = "#d4574e"
const BLUE = "#4f7fd1"
const GREEN = "#4f9a6a"
const YELLOW = "#d9a93f"
const WOOD = "#b89574"
const GREY = "#a1a1aa"

const SCENES: Record<string, Shape[]> = {
  "stack-two-blocks": [
    { t: "box", x: 70, y: 66, w: 22, h: 18, c: RED },
    { t: "box", x: 72, y: 50, w: 18, h: 16, c: BLUE },
  ],
  "pick-red-cube": [
    { t: "dish", x: 100, y: 80, rx: 20, ry: 8, c: GREY },
    { t: "box", x: 48, y: 70, w: 16, h: 14, c: RED },
  ],
  "open-drawer": [
    { t: "box", x: 50, y: 48, w: 60, h: 36, c: WOOD },
    { t: "box", x: 72, y: 62, w: 16, h: 3, c: "#7c6248" },
  ],
  "sort-by-color": [
    { t: "box", x: 34, y: 80, w: 30, h: 8, c: RED },
    { t: "box", x: 96, y: 80, w: 30, h: 8, c: BLUE },
    { t: "box", x: 62, y: 62, w: 12, h: 10, c: BLUE },
    { t: "box", x: 82, y: 66, w: 12, h: 10, c: RED },
  ],
  "pour-into-cup": [
    { t: "box", x: 52, y: 62, w: 16, h: 22, c: YELLOW },
    { t: "box", x: 88, y: 56, w: 24, h: 28, c: GREY },
  ],
  "wipe-table": [
    { t: "dish", x: 92, y: 80, rx: 22, ry: 7, c: "#9cc3e6" },
    { t: "box", x: 50, y: 72, w: 22, h: 10, c: GREEN },
  ],
}

export function DatasetThumb({ taskId, className }: { taskId: string; className?: string }) {
  const shapes = SCENES[taskId] ?? []
  return (
    <svg
      viewBox="0 0 160 120"
      className={cn("aspect-[4/3] shrink-0 rounded-md border bg-[#d4d4d8]", className)}
      role="img"
      aria-label="Thumbnail"
    >
      {/* Workbench */}
      <path d="M0 120 L22 34 L138 34 L160 120 Z" fill="#f4f4f5" />
      {/* Scale objects up around the centre so they stay visible in small thumbnails */}
      <g transform="translate(80 70) scale(1.7) translate(-80 -68)">
        {shapes.map((s, i) =>
          s.t === "box" ? (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx="2" fill={s.c} />
          ) : (
            <ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={s.c} />
          ),
        )}
      </g>
    </svg>
  )
}
