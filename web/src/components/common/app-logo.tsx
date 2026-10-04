import { cn } from "@/lib/utils"

/** Apprentice mark: an "A" drawn as a two-link arm (same drawing as public/favicon.svg) */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#171717" />
      <path d="M9 24 16 9.5 23 24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.3 18.6h7.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="24" r="1.9" fill="#fff" />
      <circle cx="23" cy="24" r="1.9" fill="#fff" />
      <circle cx="16" cy="9.5" r="2.7" fill="#3b82f6" stroke="#171717" strokeWidth="1" />
    </svg>
  )
}
