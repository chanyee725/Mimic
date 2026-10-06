import { cn } from "@/lib/utils"

/** Settings layout: inputs below a section title, dividers between sections. */
export function SettingsGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y rounded-lg border", className)}>{children}</div>
}

/** `action` sits on the right of the title (e.g. a connection status with its Test button) */
export function SettingsSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4 p-5">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <h3 className="py-1 text-sm font-semibold">{title}</h3>
        {action}
      </div>
      <div className="grid min-w-0 gap-4 [&>*]:min-w-0">{children}</div>
    </section>
  )
}
