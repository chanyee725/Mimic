import { StatusDot, type Tone } from "@/components/common/status-dot"
import { LinkButton } from "@/components/common/link-button"
import { EmptyState } from "@/components/common/empty-state"
import type { SimEnv } from "@/domain/simulation"
import { cn } from "@/lib/utils"

import { evalHref, type ModelCompat } from "../envs"

function compatStatus({ issues, usable }: ModelCompat): { tone: Tone; label: string; detail?: string } {
  if (!usable) return { tone: "bad", label: "Not compatible", detail: issues.filter((i) => i.level === "error")[0]?.text }
  if (issues.length) return { tone: "warn", label: "Compatible", detail: issues.map((i) => i.text).join(", ") }
  return { tone: "ok", label: "Compatible" }
}

/** Every saved model and whether it can be loaded into this environment */
export function EnvCompatList({ env, rows }: { env: SimEnv; rows: ModelCompat[] }) {
  const usable = rows.filter((r) => r.usable).length

  return (
    <section className="grid content-start gap-2">
      <h3 className="flex items-baseline gap-1.5 text-sm font-semibold">
        Models
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {usable} of {rows.length} compatible
        </span>
      </h3>
      {env.state !== "ready" ? (
        <EmptyState>환경을 불러오지 못해 모델을 넣어 볼 수 없습니다.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>저장한 모델이 없습니다.</EmptyState>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => {
            const s = compatStatus(r)
            const ownTask = !!env.taskId && r.model.taskId === env.taskId
            return (
              <li key={r.model.id} className="flex items-center gap-3 px-3 py-2">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-[13px]">{r.model.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.model.taskId}
                    {ownTask && ", same task"}
                  </span>
                </div>
                <div className="grid max-w-[50%] min-w-0 shrink-0 justify-items-end gap-0.5 text-right">
                  <StatusDot tone={s.tone} className="text-[13px]">
                    {s.label}
                  </StatusDot>
                  {s.detail && (
                    <span className={cn("max-w-full truncate text-xs", s.tone === "bad" ? "text-bad" : "text-warn")} title={s.detail}>
                      {s.detail}
                    </span>
                  )}
                </div>
                <LinkButton
                  to={evalHref(env.id, r.model.id)}
                  variant="outline"
                  size="xs"
                  disabled={!r.usable}
                  className={r.usable ? undefined : "invisible"}
                >
                  Evaluate
                </LinkButton>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
