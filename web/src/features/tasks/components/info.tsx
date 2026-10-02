/** Read-only value loaded from the rig */
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-[13px]">{children}</span>
    </div>
  )
}
