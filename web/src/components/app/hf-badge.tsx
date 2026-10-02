import { cn } from "@/lib/utils"

/** 작은 크기에서도 또렷한 Hugging Face 얼굴 (공식 로고 색을 단순화) */
function HfFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx="8" cy="8" r="7.25" fill="#FFD21E" stroke="#F2B700" strokeWidth="0.75" />
      <circle cx="5.6" cy="6.6" r="1.05" fill="#3D2E00" />
      <circle cx="10.4" cy="6.6" r="1.05" fill="#3D2E00" />
      <path d="M4.9 9.3 Q8 12.6 11.1 9.3" fill="none" stroke="#3D2E00" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/** HF Hub 에 올라간 항목 표시 */
export function HfBadge({ className, title = "On HF Hub" }: { className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full bg-yellow-100 py-0.5 pr-1.5 pl-0.5 text-[10px] leading-none font-semibold text-yellow-900",
        className,
      )}
    >
      <HfFace className="size-3.5" />
      HF
    </span>
  )
}
