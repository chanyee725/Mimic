import { MODEL_FILES } from "@/dummy/models"

import { formatFileSize } from "../lib"

/** Files inside the checkpoint folder */
export function ModelFiles() {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">Files</h3>
      <ul className="divide-y rounded-md border">
        {MODEL_FILES.map((f) => (
          <li key={f.path} className="flex justify-between gap-3 px-3 py-1.5 text-[13px]">
            <span className="truncate">{f.path}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatFileSize(f.sizeMB)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
