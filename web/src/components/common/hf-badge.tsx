import { SiHuggingface } from "react-icons/si"

import { cn } from "@/lib/utils"

/** Marks items uploaded to HF Hub: the yellow Hugging Face logo on a small black square */
export function HfBadge({ className, title = "On HF Hub" }: { className?: string; title?: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-grid size-4 shrink-0 place-items-center rounded-[4px] bg-black", className)}
    >
      <SiHuggingface className="size-3 text-[#FFD21E]" aria-hidden />
    </span>
  )
}

/** Push button once uploaded: black with white text (the icon inside is the yellow HF logo), not dimmed when disabled */
export const PUSHED_BUTTON = "border-black bg-black text-white hover:bg-black/85 hover:text-white disabled:opacity-100"
