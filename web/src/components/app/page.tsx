import { Link } from "react-router-dom"
import { LuArrowRight } from "react-icons/lu"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/** 페이지 본문 상단 제목 */
function PageTitle({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

/**
 * Dashboard 형식의 페이지 틀.
 * 상단 바 없이 제목·설명(+우측 액션)을 두고, 그 아래를 패널로 채운다.
 * fit 이면 데스크톱(lg)에서 화면 높이에 맞추고 패널 내부만 스크롤한다.
 */
export function Page({
  title,
  description,
  actions,
  fit = false,
  className,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  fit?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 md:p-6", fit && "lg:h-svh", className)}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {/* 데스크톱은 사이드바 안의 토글을 쓰고, 모바일(오프캔버스)에서만 노출 */}
        <SidebarTrigger className="mt-1 md:hidden" />
        <div className="min-w-0 flex-1">
          <PageTitle title={title} description={description} />
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/** 테두리 패널. 제목(text-sm semibold)과 우측 보조 액션 */
export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("flex min-h-0 flex-col gap-3 rounded-lg border p-5", className)}>
      {(title || action) && (
        <div className="flex items-baseline justify-between gap-4">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** 패널 우측 상단의 "더 보기" 링크 */
export function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
      {children}
      <LuArrowRight className="size-3.5" />
    </Link>
  )
}
