import { SiHuggingface } from "react-icons/si"

import { cn } from "@/lib/utils"

/** Marks items uploaded to HF Hub: the Hugging Face glyph in the muted icon colour, like the other small marks */
export function HfBadge({ className, title = "On HF Hub" }: { className?: string; title?: string }) {
  return (
    <span title={title} aria-label={title} className={cn("inline-grid size-4 shrink-0 place-items-center", className)}>
      <SiHuggingface className="size-3.5 text-muted-foreground" aria-hidden />
    </span>
  )
}
