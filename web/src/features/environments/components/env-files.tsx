import type { SimEnvFile } from "@/domain/simulation"

import { formatKB } from "../lib"

export function EnvFiles({ files }: { files: SimEnvFile[] }) {
  return (
    <section className="grid content-start gap-2">
      <h3 className="text-sm font-semibold">Files</h3>
      <ul className="divide-y rounded-md border">
        {files.map((f) => (
          <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
            <span className="truncate font-mono">{f.path}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatKB(f.sizeKB)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
