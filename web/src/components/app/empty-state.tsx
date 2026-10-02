import { cn } from "@/lib/utils"

/** 점선 상자 안의 안내 문구 (목록 · 섹션이 비었을 때) */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-dashed py-6 text-center text-[13px] text-muted-foreground", className)}>{children}</div>
  )
}
