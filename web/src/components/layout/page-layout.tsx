import { Link } from "react-router-dom"
import { LuArrowRight } from "react-icons/lu"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/** Page title at the top of the content */
function PageTitle({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

/**
 * Dashboard-style page frame.
 * Title and description (plus actions on the right) without a top bar, then panels below.
 * Without a title or actions the header row is left out (the page names itself, e.g. with an sr-only heading).
 * With fit, it fills the viewport height on desktop (lg) and only panels scroll.
 */
export function Page({
  title,
  description,
  actions,
  fit = false,
  className,
  children,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  fit?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-4 p-4 md:p-6", fit && "lg:h-svh", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          {/* Desktop uses the toggle inside the sidebar; this one only shows on mobile (off-canvas) */}
          <SidebarTrigger className="mt-1 md:hidden" />
          <div className="min-w-0 flex-1">{title && <PageTitle title={title} description={description} />}</div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

/** Bordered panel with a title (text-sm semibold) and an optional action on the right */
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

/** "View more" link in the top right of a panel */
export function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
      {children}
      <LuArrowRight className="size-3.5" />
    </Link>
  )
}
