import { cn } from "@/lib/utils"

const TENTACLES = [
  "M21 34c-4 6-9 8-11 13s2 8 5 5",
  "M28 37c-1 6-4 9-4 13s3 5 5 3",
  "M36 37c1 6 4 9 4 13s-3 5-5 3",
  "M43 34c4 6 9 8 11 13s-2 8-5 5",
]

/** Mimic mark: a mimic octopus (the animal that imitates others) with banded tentacles (same drawing as public/favicon.svg) */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx="16" fill="#171717" />
      <g fill="none" strokeWidth="6">
        {TENTACLES.map((d) => (
          <path key={d} d={d} stroke="#ff7a45" strokeLinecap="round" />
        ))}
        {TENTACLES.map((d) => (
          <path key={d} d={d} stroke="#ffe3d3" strokeDasharray="2.6 4.4" strokeDashoffset="-5" />
        ))}
      </g>
      <path d="M15 28c0-10 7.6-17 17-17s17 7 17 17c0 6-4 10-9 10H24c-5 0-9-4-9-10z" fill="#ff7a45" />
      <circle cx="25" cy="27" r="5" fill="#fff" />
      <circle cx="39" cy="27" r="5" fill="#fff" />
      <circle cx="27" cy="27.5" r="2.4" fill="#171717" />
      <circle cx="41" cy="27.5" r="2.4" fill="#171717" />
    </svg>
  )
}
