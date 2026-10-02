import { cn } from "@/lib/utils"

import { SPEEDS, type Speed } from "../lib"

/** 재생 배속 선택 */
export function SpeedToggle({ value, onChange }: { value: Speed; onChange: (s: Speed) => void }) {
  return (
    <div className="flex shrink-0 rounded-md border p-0.5" role="group" aria-label="Playback speed">
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={cn(
            "h-6 rounded-sm px-2 text-xs tabular-nums transition-colors",
            value === s ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s}x
        </button>
      ))}
    </div>
  )
}
