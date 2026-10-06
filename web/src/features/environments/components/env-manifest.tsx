import type { SimEnv } from "@/domain/simulation"

import { formatKB } from "../lib"

/** Files found in the environment folder */
export function EnvFiles({ env }: { env: SimEnv }) {
  return (
    <section className="grid content-start gap-2">
      <h3 className="text-sm font-semibold">Files</h3>
      <ul className="divide-y rounded-md border">
        {env.files.map((f) => (
          <li key={f.path} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[13px]">
            <span className="truncate font-mono">{f.path}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatKB(f.sizeKB)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** env.yaml as found on disk */
export function EnvManifest({ env }: { env: SimEnv }) {
  return (
    <section className="grid content-start gap-2">
      <h3 className="text-sm font-semibold">env.yaml</h3>
      <pre className="max-h-72 overflow-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs leading-5 text-muted-foreground">
        {env.manifest}
      </pre>
    </section>
  )
}
