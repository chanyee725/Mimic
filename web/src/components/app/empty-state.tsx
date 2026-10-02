import { cn } from "@/lib/utils"

/** Hint text in a dashed box, for empty lists or sections */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-dashed py-6 text-center text-[13px] text-muted-foreground", className)}>{children}</div>
  )
}
