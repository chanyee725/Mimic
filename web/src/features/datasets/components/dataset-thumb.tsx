import { LuImageOff } from "react-icons/lu"

import { cn } from "@/lib/utils"

/** Thumbnail slot. The real one is the first camera frame of the first episode; until videos exist (501) it stays empty. */
export function DatasetThumb({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid aspect-[4/3] shrink-0 place-items-center rounded-md border bg-stage text-muted-foreground", className)}
      role="img"
      aria-label="No thumbnail"
    >
      <LuImageOff className="size-4" aria-hidden />
    </div>
  )
}
