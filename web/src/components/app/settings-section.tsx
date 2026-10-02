import { cn } from "@/lib/utils"

/** 설정 화면 형식: 섹션 제목 아래 입력. 섹션 사이는 구분선. */
export function SettingsGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y rounded-lg border", className)}>{children}</div>
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}
