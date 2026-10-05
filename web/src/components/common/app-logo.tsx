import { cn } from "@/lib/utils"

/** Mimic mark: an "M" drawn as two mirrored two-link arms (same drawing as public/favicon.svg) */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#171717" />
      <path d="M8.5 24 11 9.5 16 18 21 9.5 23.5 24" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="24" r="1.9" fill="#fff" />
      <circle cx="23.5" cy="24" r="1.9" fill="#fff" />
      <circle cx="16" cy="18" r="2.7" fill="#3b82f6" stroke="#171717" strokeWidth="1" />
    </svg>
  )
}
