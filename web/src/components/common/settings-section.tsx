import { cn } from "@/lib/utils"

/** Settings layout: inputs below a section title, dividers between sections. */
export function SettingsGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("divide-y rounded-lg border", className)}>{children}</div>
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid min-w-0 gap-4 [&>*]:min-w-0">{children}</div>
    </section>
  )
}
