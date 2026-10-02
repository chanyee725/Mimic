import { SiHuggingface } from "react-icons/si"

import { cn } from "@/lib/utils"

/** HF Hub 에 올라간 항목 표시. 검은 바탕에 노란 Hugging Face 로고 */
export function HfBadge({ className, title = "On HF Hub" }: { className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-black py-0.5 pr-1.5 pl-1 text-[10px] leading-none font-semibold text-white",
        className,
      )}
    >
      <SiHuggingface className="size-3 text-[#FFD21E]" aria-hidden />
      HF
    </span>
  )
}
