import { cn } from "@/lib/utils"

/** 설정 화면 형식: 왼쪽 제목·설명 / 오른쪽 입력. 섹션 사이는 구분선. */
export function SettingsGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y rounded-lg border", className)}>{children}</div>
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 p-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      <div className="grid content-start gap-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="grid max-w-160 gap-4">{children}</div>
    </section>
  )
}
